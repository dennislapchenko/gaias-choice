import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ApiError, type TelegramChallenge } from '../lib/api'
import { useI18n } from '../lib/i18n'
import { useSession } from '../lib/session'

// The centered sign-in dialog over a blurred backdrop, rendered by
// SessionProvider whenever `loginOpen` is true. Telegram-username sign-in is
// the primary method: claim a @username → tap the t.me/<bot>?start=<code> deep
// link → the bot confirms the sender is really you → the dialog polls for the
// grant. The two email methods (one-time link, password) demote to square
// toggles at the bottom; first sign-in by any method creates a viewer account
// server-side, so there is no separate registration form.
export default function LoginDialog() {
  const { t, locale } = useI18n()
  const { login, requestMagicLink, requestTelegram, pollTelegram, acceptGrant, closeLogin } =
    useSession()
  const [mode, setMode] = useState<'telegram' | 'magic' | 'password' | 'sent'>('telegram')
  const [username, setUsername] = useState('')
  const [challenge, setChallenge] = useState<TelegramChallenge | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const firstRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    firstRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLogin()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Poll the Telegram handshake while it's live. Grant ⇒ sign in; a dead code
  // (expired/consumed) ⇒ drop back to the claim step with a note.
  useEffect(() => {
    if (!challenge) return
    let alive = true
    const id = setInterval(async () => {
      try {
        const grant = await pollTelegram(challenge.code)
        if (!alive || !grant) return
        clearInterval(id)
        acceptGrant(grant)
        closeLogin()
      } catch {
        if (!alive) return
        clearInterval(id)
        setChallenge(null)
        setError(t('login.telegramExpired'))
      }
    }, 2000)
    return () => {
      alive = false
      clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge])

  const errorText = (err: unknown): string => {
    if (err instanceof ApiError) {
      if (err.status === 401) return t('login.badCredentials')
      if (err.status === 400) return t('login.invalid')
      if (err.status === 429) return t('login.tooMany')
      if (err.status === 503)
        return mode === 'telegram' ? t('login.telegramUnavailable') : t('login.magicUnavailable')
    }
    return t('login.failed')
  }

  const submitTelegram = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      setChallenge(await requestTelegram(username))
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const submitEmail = async (e: FormEvent) => {
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

  const switchMode = (next: 'telegram' | 'magic' | 'password') => {
    setMode(next)
    setError(null)
    setChallenge(null)
  }

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

        {mode === 'sent' && <p>{t('login.sent')}</p>}

        {mode === 'telegram' &&
          (challenge ? (
            <div className="login-tg-wait">
              <a
                className="btn btn-primary login-submit"
                href={`https://t.me/${challenge.bot}?start=${challenge.code}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('login.telegramOpen')}
              </a>
              <p className="login-tg-status">
                <span className="login-spinner" aria-hidden="true" />
                {t('login.telegramWaiting')}
              </p>
              <button
                type="button"
                className="login-switch"
                onClick={() => {
                  setChallenge(null)
                  setError(null)
                }}
              >
                {t('login.telegramCancel')}
              </button>
            </div>
          ) : (
            <form onSubmit={submitTelegram}>
              <p className="login-tg-hint">{t('login.telegramHint')}</p>
              <label className="login-field">
                <span>{t('login.telegramUsername')}</span>
                <input
                  ref={firstRef}
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="@yourname"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                />
              </label>
              {error && <p className="login-error">{error}</p>}
              <button type="submit" className="btn btn-primary login-submit" disabled={busy}>
                {t('login.telegramContinue')}
              </button>
            </form>
          ))}

        {(mode === 'magic' || mode === 'password') && (
          <form onSubmit={submitEmail}>
            <label className="login-field">
              <span>{t('login.email')}</span>
              <input
                ref={firstRef}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </label>
            {mode === 'password' && (
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
              {mode === 'password' ? t('login.submitSignIn') : t('login.sendLink')}
            </button>
          </form>
        )}

        {/* The two email methods live as square toggles under the primary
            Telegram flow; from an email mode, one link goes back to it. */}
        {mode === 'telegram' && !challenge && (
          <div className="login-alt">
            <button type="button" className="login-alt-btn" onClick={() => switchMode('magic')}>
              <span className="login-alt-icon" aria-hidden="true">
                ✉
              </span>
              {t('login.withMagic')}
            </button>
            <button type="button" className="login-alt-btn" onClick={() => switchMode('password')}>
              <span className="login-alt-icon" aria-hidden="true">
                🔒
              </span>
              {t('login.withPassword')}
            </button>
          </div>
        )}
        {(mode === 'magic' || mode === 'password' || mode === 'sent') && (
          <button type="button" className="login-switch" onClick={() => switchMode('telegram')}>
            {t('login.backToTelegram')}
          </button>
        )}
      </div>
    </div>
  )
}
