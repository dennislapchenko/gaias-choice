// The login session, one seam for the whole app. Owns the stored token
// (localStorage['gc-session']), validates it against /api/auth/me, exposes
// login / register / signOut, and hosts the LoginDialog open state (the
// dialog itself renders here so any component can summon it).
//
// Progressive enhancement rule: `backendUp` is false whenever the API cannot
// be reached — every consumer (header button, account page, edit chrome)
// renders nothing in that case, so the static site stays identical for
// readers when the backend is absent.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  apiGet,
  apiPost,
  ApiError,
  type LoginResponse,
  type MeResponse,
  type RegisterPayload,
} from './api'
import LoginDialog from '../components/LoginDialog'

const SESSION_KEY = 'gc-session'
const LEGACY_TOKEN_KEY = 'gc-edit-token' // pre-login static token; cleared on sight

interface SessionState {
  token: string | null
  /** The validated signed-in user; null when signed out or the BE is down. */
  me: MeResponse | null
  /** The API answered — the gate for rendering any account/login chrome. */
  backendUp: boolean
  login: (email: string, password: string) => Promise<void>
  register: (payload: RegisterPayload) => Promise<void>
  /** Revoke the session server-side (best effort) and clear it locally. */
  signOut: () => void
  loginOpen: boolean
  openLogin: () => void
  closeLogin: () => void
}

const SessionContext = createContext<SessionState>({
  token: null,
  me: null,
  backendUp: false,
  login: async () => {},
  register: async () => {},
  signOut: () => {},
  loginOpen: false,
  openLogin: () => {},
  closeLogin: () => {},
})

export const useSession = (): SessionState => useContext(SessionContext)

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

function storeToken(token: string | null) {
  try {
    if (token === null) localStorage.removeItem(SESSION_KEY)
    else localStorage.setItem(SESSION_KEY, token)
  } catch {
    /* storage unavailable — the session simply won't persist */
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    try {
      localStorage.removeItem(LEGACY_TOKEN_KEY)
    } catch {
      /* ignore */
    }
    return readStoredToken()
  })
  const [me, setMe] = useState<MeResponse | null>(null)
  const [backendUp, setBackendUp] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)

  // Validate the stored session (or, signed out, just probe the backend).
  // 401 ⇒ expired/revoked — drop the token. Any other failure ⇒ backend
  // unreachable — keep the token for next time, render reader chrome only.
  useEffect(() => {
    let alive = true
    if (!token) {
      apiGet<{ status: string }>('/healthz')
        .then(() => alive && setBackendUp(true))
        .catch(() => alive && setBackendUp(false))
      return () => {
        alive = false
      }
    }
    apiGet<MeResponse>('/auth/me', { token })
      .then((res) => {
        if (!alive) return
        setMe(res)
        setBackendUp(true)
      })
      .catch((err: unknown) => {
        if (!alive) return
        setMe(null)
        if (err instanceof ApiError && err.status === 401) {
          storeToken(null)
          setToken(null)
          setBackendUp(true) // the API answered; only the session was dead
        } else {
          setBackendUp(false)
        }
      })
    return () => {
      alive = false
    }
  }, [token])

  const accept = (grant: LoginResponse, email: string) => {
    storeToken(grant.token)
    // Provisional `me` for instant chrome; the token effect fetches the real
    // one (with the server-decided `editing`) right after.
    setMe({ email, role: grant.role, displayName: grant.displayName, editing: false })
    setToken(grant.token)
  }

  const login = async (email: string, password: string) => {
    accept(await apiPost<LoginResponse>('/auth/login', { email, password }), email)
  }

  const register = async (payload: RegisterPayload) => {
    accept(await apiPost<LoginResponse>('/auth/register', payload), payload.email)
  }

  const signOut = () => {
    const stored = readStoredToken()
    if (stored) {
      apiPost('/auth/logout', undefined, { token: stored }).catch(() => {})
    }
    storeToken(null)
    setToken(null)
    setMe(null)
  }

  return (
    <SessionContext.Provider
      value={{
        token,
        me,
        backendUp,
        login,
        register,
        signOut,
        loginOpen,
        openLogin: () => setLoginOpen(true),
        closeLogin: () => setLoginOpen(false),
      }}
    >
      {children}
      {loginOpen && <LoginDialog />}
    </SessionContext.Provider>
  )
}
