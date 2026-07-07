// Edit-mode state (live-edit seam), a thin consumer of the login session
// (./session.tsx owns the token). Invisible to readers: mode turns on only
// when the signed-in user's /api/auth/me reports `editing: true` — which the
// backend grants only to admin/editor roles with a content storage backend
// configured. Viewers, signed-out visitors, and a downed BE all mean the
// site renders exactly as it does for everyone (zero editing chrome).
//
// `#edit` in the URL remains the deliberate shortcut: signed out it opens
// the login dialog; signed in it's a no-op (chrome already follows the
// role). Signing out happens on the account page.
import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { useSession } from './session'

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

export function EditModeProvider({ children }: { children: ReactNode }) {
  const { token, me, signOut, openLogin } = useSession()

  useEffect(() => {
    const maybeOpen = () => {
      if (window.location.hash !== '#edit') return
      history.replaceState(null, '', window.location.pathname + window.location.search)
      if (!token) openLogin()
    }
    maybeOpen()
    window.addEventListener('hashchange', maybeOpen)
    return () => window.removeEventListener('hashchange', maybeOpen)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return (
    <EditModeContext.Provider
      value={{ active: me?.editing ?? false, token, deactivate: signOut }}
    >
      {children}
    </EditModeContext.Provider>
  )
}
