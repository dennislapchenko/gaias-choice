import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ApiError } from '../lib/api'
import { useI18n } from '../lib/i18n'
import { useSession } from '../lib/session'

// The centered sign-in dialog over a blurred backdrop, rendered by
// SessionProvider whenever `loginOpen` is true. Sign-in is passwordless-first:
// email in, one-time link out, and the #magic=<token> landing in session.tsx
// finishes the job (first sign-in creates a viewer account server-side, so
// there is no separate registration form). The password form stays as the
// fallback for accounts that have one (admin/bootstrap); WebAuthn passkeys
// are planned once the site sits on its permanent domain.
export default function LoginDialog() {
  const { t, locale } = useI18n()
  const { login, requestMagicLink, closeLogin } = useSession()
  const [mode, setMode] = useState<'magic' | 'password' | 'sent'>('magic')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    emailRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLogin()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const errorText = (err: unknown): string => {
    if (err instanceof ApiError) {
      if (err.status === 401) return t('login.badCredentials')
      if (err.status === 400) return t('login.invalid')
      if (err.status === 429) return t('login.tooMany')
      if (err.status === 503) return t('login.magicUnavailable')
    }
    return t('login.failed')
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (mode === 'password') {
        await login(email, password)
        closeLogin()
      } else {
        await requestMagicLink(email, locale)
        setMode('sent')
        setBusy(false)
      }
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  const usingPassword = mode === 'password'

  return (
    <div
      className="login-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeLogin()
      }}
    >
      <div className="login-dialog" role="dialog" aria-modal="true" aria-labelledby="login-title">
        <button
          type="button"
          className="login-close"
          onClick={closeLogin}
          aria-label={t('login.close')}
        >
          ×
        </button>
        <h2 id="login-title">{t('login.signIn')}</h2>
        {mode === 'sent' ? (
          <p>{t('login.sent')}</p>
        ) : (
          <>
            <form onSubmit={submit}>
              <label className="login-field">
                <span>{t('login.email')}</span>
                <input
                  ref={emailRef}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </label>
              {usingPassword && (
                <label className="login-field">
                  <span>{t('login.password')}</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </label>
              )}
              {error && <p className="login-error">{error}</p>}
              <button type="submit" className="btn btn-primary login-submit" disabled={busy}>
                {usingPassword ? t('login.submitSignIn') : t('login.sendLink')}
              </button>
            </form>
            <button
              type="button"
              className="login-switch"
              onClick={() => {
                setMode(usingPassword ? 'magic' : 'password')
                setError(null)
              }}
            >
              {usingPassword ? t('login.useMagic') : t('login.usePassword')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
