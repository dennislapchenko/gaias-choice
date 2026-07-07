// Edit-mode state (live-edit seam). Invisible to readers: mode turns on only
// when a stored session validates against the backend's /api/auth/me AND the
// backend reports a content storage backend is configured — no session, an
// expired one, or BE down all mean the site renders exactly as it does for
// everyone (zero editing chrome).
//
// Activation: visit any page with `#edit` in the URL → an email prompt
// (entering an empty value signs out) then a password prompt; the hash is
// stripped either way. A successful login stores the opaque session token in
// localStorage['gc-session'] (revocable, 30-day TTL server-side). Accounts
// are admin/editor users in the backend DB — there is no self-registration.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { apiGet, apiPost, ApiError, type LoginResponse, type MeResponse } from './api'

const SESSION_KEY = 'gc-session'
const LEGACY_TOKEN_KEY = 'gc-edit-token' // pre-login static token; cleared on sight

interface EditModeState {
  active: boolean
  token: string | null
  /** Revoke the session server-side, clear it locally, leave edit mode. */
  deactivate: () => void
}

const EditModeContext = createContext<EditModeState>({
  active: false,
  token: null,
  deactivate: () => {},
})

export const useEditMode = (): EditModeState => useContext(EditModeContext)

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

export function EditModeProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    try {
      localStorage.removeItem(LEGACY_TOKEN_KEY)
    } catch {
      /* ignore */
    }
    return readStoredToken()
  })
  const [active, setActive] = useState(false)

  const signOut = () => {
    const stored = readStoredToken()
    if (stored) {
      // Best-effort revocation — locally we're signed out either way.
      apiPost('/auth/logout', undefined, { token: stored }).catch(() => {})
    }
    try {
      localStorage.removeItem(SESSION_KEY)
    } catch {
      /* ignore */
    }
    setToken(null)
    setActive(false)
  }

  // #edit in the URL is the (deliberately undiscoverable) activation switch.
  useEffect(() => {
    const maybePrompt = () => {
      if (window.location.hash !== '#edit') return
      // Strip the hash first so credentials never linger in the URL bar flow.
      history.replaceState(null, '', window.location.pathname + window.location.search)
      const email = window.prompt('Email (leave empty to sign out):')
      if (email === null) return // cancelled — no change
      if (email === '') {
        signOut()
        return
      }
      const password = window.prompt('Password:')
      if (!password) return
      apiPost<LoginResponse>('/auth/login', { email, password })
        .then((res) => {
          try {
            localStorage.setItem(SESSION_KEY, res.token)
          } catch {
            /* storage unavailable — mode simply won't persist */
          }
          setToken(res.token)
        })
        .catch(() => {
          // The owner asked for edit mode explicitly — failing silently here
          // would just look broken. Readers never reach this path.
          window.alert('Login failed.')
        })
    }
    maybePrompt()
    window.addEventListener('hashchange', maybePrompt)
    return () => window.removeEventListener('hashchange', maybePrompt)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Validate the session against /auth/me. 401 ⇒ expired/revoked — drop it.
  // Anything else (BE down, non-JSON) ⇒ keep the token but stay off,
  // silently — the reader experience is untouched. `editing:false` (no
  // storage backend configured) also stays off: chrome without a working
  // save path would only mislead.
  useEffect(() => {
    if (!token) {
      setActive(false)
      return
    }
    let alive = true
    apiGet<MeResponse>('/auth/me', { token })
      .then((me) => {
        if (alive) setActive(me.editing)
      })
      .catch((err: unknown) => {
        if (!alive) return
        setActive(false)
        if (err instanceof ApiError && err.status === 401) {
          try {
            localStorage.removeItem(SESSION_KEY)
          } catch {
            /* ignore */
          }
          setToken(null)
        }
      })
    return () => {
      alive = false
    }
  }, [token])

  return (
    <EditModeContext.Provider value={{ active, token, deactivate: signOut }}>
      {children}
    </EditModeContext.Provider>
  )
}
