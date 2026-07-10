import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ApiError, type TelegramChallenge } from '../lib/api'
import { useI18n } from '../lib/i18n'
import { useSession } from '../lib/session'
import { useVisibleViewportVars } from '../lib/viewport'

// Telegram's paper-plane mark — an inline SVG so it inherits the button text
// color (currentColor) and sits like the ✉ / 🔒 icons on the alt toggles.
// Reused verbatim if Telegram ever demotes to a square toggle.
const TelegramIcon = () => (
  <svg className="login-tg-icon" viewBox="0 0 448 512" fill="currentColor" aria-hidden="true">
    <path d="M446.7 98.6l-67.6 318.8c-5.1 22.5-18.4 28.1-37.3 17.5l-103-75.9-49.7 47.8c-5.5 5.5-10.1 10.1-20.7 10.1l7.4-104.9 190.9-172.5c8.3-7.4-1.8-11.5-12.9-4.1L117.8 284 16.2 252.2c-22.1-6.9-22.5-22.1 4.6-32.7L418.2 66.4c18.4-6.9 34.5 4.1 28.5 32.2z" />
  </svg>
)

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
  // Handle to the tab we opened for the t.me deep link, so we can close it
  // once the grant lands and hand focus back to this (the site) tab.
  const tgWin = useRef<Window | null>(null)

  // Mounted only while open — size the dialog to the visible viewport so the
  // auto-focused input's keyboard can't bury it on mobile (see the hook).
  useVisibleViewportVars(true)

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
        tgWin.current?.close() // return focus from the Telegram tab to the site
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
                className="btn btn-primary login-submit login-tg-submit"
                href={`https://t.me/${challenge.bot}?start=${challenge.code}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  // Open via script so we keep a handle to close on grant.
                  // (no `noopener` here — that's what the null-check falls back
                  // to native nav for; mobile app-switch can't be forced back.)
                  const w = window.open(e.currentTarget.href, '_blank')
                  if (w) {
                    tgWin.current = w
                    e.preventDefault()
                  }
                }}
              >
                <TelegramIcon />
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
              <button
                type="submit"
                className="btn btn-primary login-submit login-tg-submit"
                disabled={busy}
              >
                <TelegramIcon />
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
