// The whole frontend↔backend contract lives in this one file.
//
// The backend is *progressive enhancement*: it is down most of the time (a
// laptop behind ngrok), and the live Pages site ships without a stable API
// URL. So every helper here fails quietly — callers render nothing on error,
// never an error page. See `useApi` and the SPA-fallback guard below.
import { useEffect, useState } from 'react'

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
  method: 'POST' | 'PUT',
  path: string,
  body?: unknown,
  opts?: { token?: string },
): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method,
    headers: { ...headers(opts?.token), 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return parseJson<T>(res)
}

export function apiPost<T>(path: string, body?: unknown, opts?: { token?: string }): Promise<T> {
  return apiSend<T>('POST', path, body, opts)
}

export function apiPut<T>(path: string, body?: unknown, opts?: { token?: string }): Promise<T> {
  return apiSend<T>('PUT', path, body, opts)
}

export async function apiDelete<T>(path: string, opts?: { token?: string }): Promise<T> {
  const res = await fetch(apiUrl(path), { method: 'DELETE', headers: headers(opts?.token) })
  return parseJson<T>(res)
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

/** DELETE /api/content/file — remove one content/ file as a git commit;
 *  `sha` is the same optimistic-concurrency handle as save. */
export interface DeleteResponse {
  path: string
  commit: string
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
