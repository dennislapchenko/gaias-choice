import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ApiError } from '../lib/api'
import { useI18n } from '../lib/i18n'
import { useSession } from '../lib/session'

// The centered sign-in / create-account dialog over a blurred backdrop.
// Rendered by SessionProvider whenever `loginOpen` is true; new accounts get
// the viewer role server-side. Passwords are a stopgap — magic-link and
// biometric (WebAuthn) sign-in are the plan once there's an SMTP server.
export default function LoginDialog() {
  const { t } = useI18n()
  const { login, register, closeLogin } = useSession()
  const [mode, setMode] = useState<'signin' | 'register'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
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
      if (err.status === 409) return t('login.emailTaken')
      if (err.status === 400) return t('login.invalid')
      if (err.status === 429) return t('login.tooMany')
    }
    return t('login.failed')
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (mode === 'signin') await login(email, password)
      else await register({ email, password, displayName })
      closeLogin()
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  const registering = mode === 'register'

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
        <h2 id="login-title">{registering ? t('login.createAccount') : t('login.signIn')}</h2>
        <form onSubmit={submit}>
          {registering && (
            <label className="login-field">
              <span>{t('login.displayName')}</span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={50}
                autoComplete="nickname"
                required
              />
            </label>
          )}
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
          <label className="login-field">
            <span>{t('login.password')}</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={registering ? 8 : undefined}
              autoComplete={registering ? 'new-password' : 'current-password'}
              required
            />
          </label>
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="btn btn-primary login-submit" disabled={busy}>
            {registering ? t('login.submitRegister') : t('login.submitSignIn')}
          </button>
        </form>
        <button
          type="button"
          className="login-switch"
          onClick={() => {
            setMode(registering ? 'signin' : 'register')
            setError(null)
          }}
        >
          {registering ? t('login.switchToSignIn') : t('login.switchToRegister')}
        </button>
      </div>
    </div>
  )
}
