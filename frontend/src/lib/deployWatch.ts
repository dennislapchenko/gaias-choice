// A content write commits to git instantly, but the live static site only
// catches up after the GitHub Pages rebuild (~1 min). This tracks that whole tail
// as a small state machine — 'publishing' the moment a publish-class write
// commits, then 'live' once the deploy that carries it lands — so ONE persistent
// pill (StatusPill.tsx, mounted above <Routes>) can bridge the gap and survive the
// navigation a delete/redirect triggers.
//
// It reads the currently-live /version.json commit as a baseline, then polls until
// it CHANGES. Baseline-change (not exact-SHA match) on purpose: the Pages workflow
// cancels an in-flight run on a newer push (concurrency: cancel-in-progress), so a
// rapid second commit's deploy is the one that lands — carrying BOTH changes. "The
// live commit moved" is the correct, robust signal; matching my own SHA would hang.
//
// version.json is stamped only by the real deploy (deploy-pages.yml), so in dev /
// the nginx image it 404s → baseline null → the machine stays idle (feature off).
// No backend push, no persistent connection.
import { useEffect, useState } from 'react'
import { withBase } from './asset'

export type DeployState = 'idle' | 'publishing' | 'live'

let state: DeployState = 'idle'
const listeners = new Set<(s: DeployState) => void>()
function set(s: DeployState) {
  state = s
  listeners.forEach((fn) => fn(s))
}
export function onDeployState(fn: (s: DeployState) => void): () => void {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}
/** Subscribe to the deploy lifecycle; drives the persistent status pill. */
export function useDeployState(): DeployState {
  const [s, setS] = useState<DeployState>(state)
  useEffect(() => onDeployState(setS), [])
  return s
}
/** Dismiss the "live" pill (its tap handler); no-op mid-publish. */
export function dismissDeploy() {
  if (state === 'live') set('idle')
}

async function liveCommit(): Promise<string | null> {
  try {
    const url = withBase('/version.json')!
    const res = await fetch(`${url}?_=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    const j = (await res.json()) as { commit?: unknown }
    return typeof j.commit === 'string' ? j.commit : null
  } catch {
    return null
  }
}

let timer: number | undefined
let clearTimer: number | undefined
const POLL_MS = 10_000
const GIVE_UP_MS = 6 * 60_000 // deploy is usually ~1 min; stop quietly well after
const LIVE_MS = 8_000 // how long the "live" confirmation lingers before clearing

// Start (or restart, on each new publish) watching for the deploy that carries it.
// ponytail: fixed 10s poll, no backoff — trivial traffic against a static file.
export async function watchDeploy(): Promise<void> {
  const baseline = await liveCommit()
  if (baseline == null) return // no version.json here → feature off, stay idle
  window.clearTimeout(timer)
  window.clearTimeout(clearTimer)
  set('publishing')
  const deadline = Date.now() + GIVE_UP_MS
  const tick = async () => {
    const now = await liveCommit()
    if (now && now !== baseline) {
      set('live')
      clearTimer = window.setTimeout(() => state === 'live' && set('idle'), LIVE_MS)
      return
    }
    if (Date.now() < deadline) timer = window.setTimeout(tick, POLL_MS)
    else set('idle') // gave up quietly — the change is committed regardless
  }
  timer = window.setTimeout(tick, POLL_MS)
}
