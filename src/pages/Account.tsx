import { useEffect, useState } from 'react'
import { apiGet, type Member, type UsersResponse } from '../lib/api'
import { usePageHead } from '../lib/head'
import { useI18n } from '../lib/i18n'
import { useSession } from '../lib/session'
import { initialOf } from '../components/UserButton'
import AccountFields from '../components/AccountFields'

// The account page: a campfire with every registered user seated around it
// in a circle — the community, visible from day one. Signed-out visitors get
// an invitation; without a backend the page degrades to a quiet note.
export default function Account() {
  const { t } = useI18n()
  const { me, token, backendUp, openLogin, signOut } = useSession()
  usePageHead(t('account.title'))

  const [members, setMembers] = useState<Member[] | null>(null)
  const [fieldsOpen, setFieldsOpen] = useState(false)
  useEffect(() => {
    if (!token || !me) return
    let alive = true
    apiGet<UsersResponse>('/users', { token })
      .then((res) => alive && setMembers(res.users))
      .catch(() => alive && setMembers(null))
    return () => {
      alive = false
    }
  }, [token, me])

  if (!me) {
    return (
      <section className="account-page">
        <h1>{t('account.title')}</h1>
        <p className="muted">{backendUp ? t('account.signedOut') : t('account.offline')}</p>
        {backendUp && (
          <button type="button" className="btn btn-primary" onClick={openLogin}>
            {t('login.open')}
          </button>
        )}
      </section>
    )
  }

  return (
    <section className="account-page">
      <div className="account-header">
        <h1>{t('account.title')}</h1>
        <button
          type="button"
          className={`cube-toggle${fieldsOpen ? ' is-open' : ''}`}
          aria-expanded={fieldsOpen}
          aria-label={t('account.fields.title')}
          onClick={() => setFieldsOpen((o) => !o)}
        >
          <GearIcon />
        </button>
      </div>
      <p className="muted">{t('account.lead')}</p>
      {fieldsOpen && <AccountFields />}

      <div className="campfire-scene" role="list">
        <Campfire />
        {(members ?? []).map((m, i, all) => {
          // Seats spread evenly around the fire, first seat at the top.
          const angle = (i / all.length) * 2 * Math.PI - Math.PI / 2
          const left = 50 + 41 * Math.cos(angle)
          const top = 50 + 41 * Math.sin(angle)
          return (
            <div
              key={`${m.displayName}-${i}`}
              role="listitem"
              className={`camper${m.you ? ' is-you' : ''}`}
              style={{ left: `${left}%`, top: `${top}%` }}
            >
              <span className="camper-avatar" aria-hidden="true">
                {m.avatarUrl ? (
                  <img className="avatar-img" src={m.avatarUrl} alt="" />
                ) : (
                  initialOf(m.displayName)
                )}
              </span>
              <span className="camper-name">
                {m.displayName}
                {m.you && <em> · {t('account.you')}</em>}
              </span>
            </div>
          )
        })}
      </div>

      <div className="account-actions">
        <button type="button" className="btn btn-ghost" onClick={signOut}>
          {t('account.signOut')}
        </button>
      </div>
    </section>
  )
}

// The header-row toggle that reveals AccountFields — a settings cog, square
// ("cube") rather than the pill shape used elsewhere, so it reads as a
// control next to the title rather than another nav pill.
function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" />
      <path
        d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M17.6 6.4l-1.5 1.5M7.9 16.1l-1.5 1.5M17.6 17.6l-1.5-1.5M7.9 7.9L6.4 6.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

function Campfire() {
  return (
    <svg className="campfire" viewBox="0 0 120 120" aria-hidden="true">
      {/* warm ground glow */}
      <ellipse cx="60" cy="102" rx="36" ry="9" fill="var(--sand-2)" />
      {/* crossed logs */}
      <rect x="30" y="88" width="60" height="9" rx="4.5" fill="#8a6248" transform="rotate(12 60 92)" />
      <rect x="30" y="88" width="60" height="9" rx="4.5" fill="#75533d" transform="rotate(-12 60 92)" />
      {/* flames, outer to inner */}
      <g className="campfire-flames">
        <path
          d="M60 22 C46 44 40 58 40 70 a20 20 0 0 0 40 0 C80 58 74 44 60 22 Z"
          fill="var(--clay)"
        />
        <path
          d="M60 38 C51 53 47 62 47 71 a13 13 0 0 0 26 0 C73 62 69 53 60 38 Z"
          fill="#f6a04d"
        />
        <path
          d="M60 54 C55 62 53 67 53 72 a7 7 0 0 0 14 0 C67 67 65 62 60 54 Z"
          fill="#ffd27a"
        />
      </g>
    </svg>
  )
}
