// Edit-mode state (live-edit seam, C2 interim gate). Invisible to readers:
// mode turns on only when a stored token validates against the backend's
// authed /api/content/ping — no token, wrong token, or BE down all mean the
// site renders exactly as it does for everyone (zero editing chrome).
//
// Activation: visit any page with `#edit` in the URL → a token prompt appears
// (entering an empty value signs out); the hash is stripped either way. The
// token persists in localStorage['gc-edit-token'] until cleared the same way.
// This is the ADMIN_TOKEN interim — real sessions/roles (backend D6) replace it.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { apiGet, ApiError } from './api'

const TOKEN_KEY = 'gc-edit-token'

interface EditModeState {
  active: boolean
  token: string | null
  /** Clear the stored token and leave edit mode. */
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
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function EditModeProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [active, setActive] = useState(false)

  // #edit in the URL is the (deliberately undiscoverable) activation switch.
  useEffect(() => {
    const maybePrompt = () => {
      if (window.location.hash !== '#edit') return
      // Strip the hash first so the token never lingers in the URL bar flow.
      history.replaceState(null, '', window.location.pathname + window.location.search)
      const input = window.prompt('Edit token (leave empty to sign out):')
      if (input === null) return // cancelled — no change
      try {
        if (input === '') localStorage.removeItem(TOKEN_KEY)
        else localStorage.setItem(TOKEN_KEY, input)
      } catch {
        /* storage unavailable — mode simply won't persist */
      }
      setActive(false)
      setToken(input === '' ? null : input)
    }
    maybePrompt()
    window.addEventListener('hashchange', maybePrompt)
    return () => window.removeEventListener('hashchange', maybePrompt)
  }, [])

  // On load (and after a prompt), pick up the stored token.
  useEffect(() => {
    if (token === null) {
      const stored = readStoredToken()
      if (stored) setToken(stored)
    }
  }, [token])

  // Validate the token against the authed ping. 401 ⇒ the token is wrong —
  // drop it. Anything else (BE down, 503 unconfigured, non-JSON) ⇒ keep the
  // token but stay off, silently — the reader experience is untouched.
  useEffect(() => {
    if (!token) {
      setActive(false)
      return
    }
    let alive = true
    apiGet<{ status: string }>('/content/ping', { token })
      .then(() => {
        if (alive) setActive(true)
      })
      .catch((err: unknown) => {
        if (!alive) return
        setActive(false)
        if (err instanceof ApiError && err.status === 401) {
          try {
            localStorage.removeItem(TOKEN_KEY)
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

  const deactivate = () => {
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* ignore */
    }
    setToken(null)
    setActive(false)
  }

  return (
    <EditModeContext.Provider value={{ active, token, deactivate }}>
      {children}
    </EditModeContext.Provider>
  )
}
