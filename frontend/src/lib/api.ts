// The whole frontend↔backend contract lives in this one file.
//
// The backend is *progressive enhancement*: it is down most of the time (a
// laptop behind ngrok), and the live Pages site ships without a stable API
// URL. So every helper here fails quietly — callers render nothing on error,
// never an error page. See `useApi` and the SPA-fallback guard below.
import { useEffect, useState } from 'react'
import { watchDeploy } from './deployWatch'

// Global in-flight counter for content mutations, so ONE floating indicator can
// say "working…" for any editor write (save / commit / delete / image / state
// flip's translate) — actions that otherwise commit silently with no obvious UI
// feedback. Reads and auth are excluded; the draft-composer enrich
// (/content/template) has its own in-dialog dimming, so it's excluded too.
let activeMutations = 0
const busyListeners = new Set<(n: number) => void>()
function setMutationCount(n: number) {
  activeMutations = n
  busyListeners.forEach((fn) => fn(n))
}
/** Subscribe to the in-flight content-mutation count; returns an unsubscribe. */
export function onBusyChange(fn: (n: number) => void): () => void {
  busyListeners.add(fn)
  fn(activeMutations)
  return () => void busyListeners.delete(fn)
}
/** True while ≥1 content mutation is in flight (drives the floating indicator). */
export function useBusy(): boolean {
  const [busy, setBusy] = useState(false)
  useEffect(() => onBusyChange((n) => setBusy(n > 0)), [])
  return busy
}

// Base URL resolution, the single rule:
//   - VITE_API_URL if set at build time (dev/ngrok, and the compose dev loop
//     sets it to http://localhost:8787/api).
//   - else same-origin `/api` — the single-container future needs zero config.
const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function apiUrl(path: string): string {
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`
}

// ngrok's free tier serves a browser-warning interstitial that breaks fetch;
// this header skips it. Harmless on any non-ngrok origin. An optional bearer
// token rides along for the authed content endpoints (edit mode).
function headers(token?: string): HeadersInit {
  const h: Record<string, string> = { Accept: 'application/json' }
  if (API_BASE.includes('ngrok')) h['ngrok-skip-browser-warning'] = '1'
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status)
  // Bodiless success (204 — /track, /auth/logout): nothing to parse, and the
  // content-type guard below would misread it as "backend unavailable".
  if (res.status === 204) return undefined as T
  // SPA-fallback guard: on GitHub Pages / nginx, unknown paths (including
  // /api/* when no backend is present) return index.html with HTTP 200. Treat
  // any non-JSON content-type as "backend unavailable", never as data.
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('application/json')) {
    throw new ApiError('non-JSON response (backend unavailable)', res.status)
  }
  return res.json() as Promise<T>
}

export async function apiGet<T>(path: string, opts?: { token?: string }): Promise<T> {
  const res = await fetch(apiUrl(path), { headers: headers(opts?.token) })
  return parseJson<T>(res)
}

async function apiSend<T>(
  method: 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  opts?: { token?: string },
): Promise<T> {
  // Busy pill: any content write (not auth, not the auto-enrich on composer open).
  const track = path.startsWith('/content/') && path !== '/content/template'
  // Deploy watch: only a *publish* moment (save / state-flip / draft / delete) —
  // NOT an intermediate image upload or the translate step, which would pop a
  // "publishing…" pill mid-edit. save/commit/DELETE-file are the commit endpoints.
  const publishes =
    path === '/content/save' || path === '/content/commit' || path === '/content/file'
  if (track) setMutationCount(activeMutations + 1)
  try {
    const res = await fetch(apiUrl(path), {
      method,
      headers: { ...headers(opts?.token), 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const data = await parseJson<T>(res)
    if (publishes) void watchDeploy() // committed → watch for the deploy going live
    return data
  } finally {
    if (track) setMutationCount(activeMutations - 1)
  }
}

export function apiPost<T>(path: string, body?: unknown, opts?: { token?: string }): Promise<T> {
  return apiSend<T>('POST', path, body, opts)
}

export function apiPut<T>(path: string, body?: unknown, opts?: { token?: string }): Promise<T> {
  return apiSend<T>('PUT', path, body, opts)
}

export function apiDelete<T>(path: string, body?: unknown, opts?: { token?: string }): Promise<T> {
  return apiSend<T>('DELETE', path, body, opts)
}

// Request/response types live here until there are enough to split out.
// They mirror backend/openapi.yaml — the endpoint contract's single source
// of truth.
export interface HelloResponse {
  message: string
  hits: number
}

export type Role = 'admin' | 'editor' | 'viewer'

/** POST /api/auth/magic/verify and /api/auth/login answer with this grant. */
export interface LoginResponse {
  token: string
  role: Role
  displayName: string
  expiresAt: string
}

/** POST /api/auth/magic — email a one-time sign-in link (the passwordless
 *  login; first redemption creates a viewer account). Always answers 200;
 *  503 when the deployment has no SMTP configured. */
export interface MagicRequestPayload {
  email: string
  /** UI locale ("ru", "en") — picks the email's language. */
  locale: string
}

/** POST /api/auth/telegram — claim a @username, get back the deep-link code +
 *  bot handle (the FE builds t.me/<bot>?start=<code>). 503 when the deployment
 *  has no bot configured. */
export interface TelegramChallenge {
  code: string
  bot: string
}

/** GET /api/auth/me — session probe; `editing` is true only for admin/editor
 *  AND when the backend has a content storage backend configured. */
export interface MeResponse {
  email: string
  role: Role
  displayName: string
  /** Missing on the provisional `me` login/register sets before the first
   *  real /auth/me fetch lands; always present ('' ⇒ none) after that. */
  avatarUrl?: string
  editing: boolean
}

/** PUT /api/users/me — update your own profile. Same shape as GET /auth/me. */
export interface UpdateMePayload {
  displayName: string
  email: string
  avatarUrl?: string
  password?: string
}

/** GET /api/users — everyone around the campfire (any signed-in user). */
export interface Member {
  id: number
  displayName: string
  avatarUrl?: string
  role: Role
  joinedAt: string // YYYY-MM-DD
  you: boolean
}

export interface UsersResponse {
  users: Member[]
}

/** PUT /api/users/{id} — admin-only edit of another user's profile
 *  (name, avatar, role, optional password reset). Never touches email. */
export interface AdminUserUpdate {
  displayName: string
  avatarUrl?: string
  role: Role
  password?: string
}

/** 200 body of PUT /api/users/{id} — the updated user summary. */
export interface AdminUserSummary {
  id: number
  displayName: string
  avatarUrl?: string
  role: Role
}

/** GET /api/content/file — current file text + blob sha (the save's
 *  optimistic-concurrency handle). */
export interface ContentFile {
  path: string
  sha: string
  content: string
}

/** POST /api/content/save — whole-file write as a git commit; omit `sha` to create. */
export interface SavePayload {
  path: string
  content: string
  sha?: string
  message?: string
}

export interface SaveResponse {
  path: string
  sha: string // new blob sha
  commit: string // the commit this save produced
}

/** DELETE /api/content/file — remove one or more content/ files in a single
 *  git commit (used to wipe a post's ru+en files together). `paths` are the
 *  files actually removed; non-existent ones are skipped. */
export interface DeleteResponse {
  paths: string[]
  commit: string
}

/** POST /api/content/commit — write several files in ONE git commit (a post's
 *  ru+en files together: a state flip + its translation, or a draft + its
 *  sibling skeleton). No sha guard. */
export interface CommitResponse {
  paths: string[]
  commit: string
}

export function commitFiles(
  files: { path: string; content: string }[],
  message: string | undefined,
  token?: string,
): Promise<CommitResponse> {
  return apiPost<CommitResponse>('/content/commit', { files, message }, { token })
}

/** POST /api/content/image — commit one browser-downscaled WebP into
 *  frontend/public/images/ as its own commit. `path` must be
 *  frontend/public/images/*.webp;
 *  `contentBase64` is the raw file bytes base64-encoded. */
export interface ImageUploadResponse {
  path: string
  commit: string
}

export function uploadImage(
  path: string,
  contentBase64: string,
  token?: string,
): Promise<ImageUploadResponse> {
  return apiPost<ImageUploadResponse>('/content/image', { path, contentBase64 }, { token })
}

/** POST /api/content/template — re-tune a blank template's guiding prompts to a
 *  post title via the backend LLM (the draft composer). 503 when no model is
 *  configured; callers fall back to the static template. */
export interface EnrichTemplateResponse {
  body: string
}

/** Ask the backend to re-tune `template`'s prompts to `title`; resolves to the
 *  new body. Rejects when enrichment is off/unreachable — callers keep the
 *  static template on any error (progressive enhancement). */
export function enrichTemplate(title: string, template: string, token?: string): Promise<string> {
  return apiPost<EnrichTemplateResponse>(
    '/content/template',
    { title, template },
    { token },
  ).then((r) => r.body)
}

/** POST /api/content/translate — faithfully translate a whole content file's
 *  prose into `targetLocale`, keeping structure/keys/links. 503 when no model
 *  is configured. The editor saves the result as the sibling file + stamps the
 *  translatedFrom mark. */
export interface TranslateResponse {
  text: string
}

/** Ask the backend to translate `text` (a full content file) into `targetLocale`;
 *  resolves to the translated file text. Rejects when translation is off/unreachable. */
export function translateContent(text: string, targetLocale: string, token?: string): Promise<string> {
  return apiPost<TranslateResponse>(
    '/content/translate',
    { text, targetLocale },
    { token },
  ).then((r) => r.text)
}

/** GET /api/stats — one row per path: summed hits over the window. */
export interface PathHits {
  path: string
  hits: number
}

export type StatsRange = 'today' | '7d' | '30d'

/** GET /api/stats?range= — admin-only page + API hit totals (the campfire's
 *  Statistics view). `pages` are SPA pageviews from /track; `api` are backend
 *  requests counted by route template. */
export interface StatsResponse {
  range: string
  pages: PathHits[]
  api: PathHits[]
}

/** POST /api/track — the cookieless pageview counter (day + path only,
 *  nothing about the visitor). Fire-and-forget: callers swallow errors — no
 *  backend simply means no analytics, never a user-visible failure. */
export function trackPageview(path: string): Promise<void> {
  return apiPost<void>('/track', { path })
}

interface ApiState<T> {
  data: T | null
  error: ApiError | Error | null
  loading: boolean
}

/**
 * Fetch `path` once on mount. Failures are swallowed into `error` (never
 * thrown), so a consumer can simply render null unless `data` is set — the
 * degradation rule that keeps the static site identical when the BE is absent.
 */
export function useApi<T>(path: string): ApiState<T> {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    error: null,
    loading: true,
  })

  useEffect(() => {
    let alive = true
    apiGet<T>(path)
      .then((data) => {
        if (alive) setState({ data, error: null, loading: false })
      })
      .catch((error: Error) => {
        if (alive) setState({ data: null, error, loading: false })
      })
    return () => {
      alive = false
    }
  }, [path])

  return state
}
