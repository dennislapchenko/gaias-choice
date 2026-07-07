import { Link } from 'react-router-dom'
import { useI18n } from '../lib/i18n'
import { useSession } from '../lib/session'

export function initialOf(name: string): string {
  const first = [...name.trim()][0]
  return (first ?? '?').toUpperCase()
}

// The header account button, sized like the language switcher. Signed out it
// opens the login dialog; signed in it shows the user's initial and leads to
// the account page (the campfire). Renders nothing when the backend is
// unreachable — readers of the static site never see it.
export default function UserButton() {
  const { me, backendUp, openLogin } = useSession()
  const { t } = useI18n()

  if (!backendUp) return null

  if (me) {
    return (
      <Link
        to="/account"
        className="user-toggle"
        aria-label={t('account.title')}
        title={me.displayName}
      >
        <span className="user-initial" aria-hidden="true">
          {initialOf(me.displayName)}
        </span>
      </Link>
    )
  }

  return (
    <button
      type="button"
      className="user-toggle"
      onClick={openLogin}
      aria-label={t('login.open')}
      title={t('login.open')}
    >
      <svg className="user-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="8" r="4" fill="currentColor" />
        <path d="M4 20.5c0-4.2 3.6-6.8 8-6.8s8 2.6 8 6.8z" fill="currentColor" />
      </svg>
    </button>
  )
}
