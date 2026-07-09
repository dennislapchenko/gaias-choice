// A content write commits to git instantly, but the live static site only
// catches up after the GitHub Pages rebuild (~2 min). This watches for that:
// after a write, it reads the currently-live /version.json commit as a baseline,
// then polls until it CHANGES — i.e. the deploy that includes this write went
// live — and fires onDeployLive so a toast can say so (DeployToast.tsx).
//
// Baseline-change (not exact-SHA match) on purpose: the Pages workflow cancels an
// in-flight run on a newer push (concurrency: cancel-in-progress), so a rapid
// second commit's deploy is the one that lands — carrying BOTH changes. "The live
// commit moved" is the correct, robust signal; matching my own SHA would hang.
//
// version.json is stamped only by the real deploy (deploy-pages.yml), so in dev /
// the nginx image it 404s → baseline null → the feature is simply off. No backend
// push, no persistent connection.
import { withBase } from './asset'

const listeners = new Set<() => void>()
export function onDeployLive(fn: () => void): () => void {
  listeners.add(fn)
  return () => void listeners.delete(fn)
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
const POLL_MS = 10_000
const GIVE_UP_MS = 6 * 60_000 // deploy is usually ~2 min; stop quietly well after

// Start (or restart, on each new write) watching for the next deploy.
// ponytail: fixed 10s poll, no backoff — trivial traffic against a static file.
export async function watchDeploy(): Promise<void> {
  const baseline = await liveCommit()
  if (baseline == null) return // no version.json here → feature off
  window.clearTimeout(timer)
  const deadline = Date.now() + GIVE_UP_MS
  const tick = async () => {
    const now = await liveCommit()
    if (now && now !== baseline) {
      listeners.forEach((fn) => fn())
      return
    }
    if (Date.now() < deadline) timer = window.setTimeout(tick, POLL_MS)
  }
  timer = window.setTimeout(tick, POLL_MS)
}
