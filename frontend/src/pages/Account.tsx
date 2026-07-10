import { useEffect, useId, useState } from 'react'
import { apiGet, type AdminUserSummary, type Member, type Role, type UsersResponse } from '../lib/api'
import { usePageHead } from '../lib/head'
import { useI18n } from '../lib/i18n'
import { useSession } from '../lib/session'
import { initialOf } from '../components/UserButton'
import AccountFields from '../components/AccountFields'
import AccountStats from '../components/AccountStats'

// The «Твои дела» row — owner tools that swap the campfire's main column for
// a work view. A registry in code on purpose (each view IS code, same idea as
// Sidebar's PANELS): adding a toggle = one entry here + a view branch in the
// main column below. `adminOnly: false` shows it to every signed-in camper.
type BizId = 'stats'
const BUSINESS_TOGGLES: { id: BizId; adminOnly: boolean; labelKey: string; icon: () => JSX.Element }[] = [
  { id: 'stats', adminOnly: true, labelKey: 'account.biz.stats', icon: ChartIcon },
]

// The account page: a campfire with every registered user seated around it
// in a circle — the community, visible from day one. Signed-out visitors get
// an invitation; without a backend the page degrades to a quiet note.
export default function Account() {
  const { t } = useI18n()
  const { me, token, backendUp, openLogin, signOut } = useSession()

  const [members, setMembers] = useState<Member[] | null>(null)
  const [fieldsOpen, setFieldsOpen] = useState(false)
  // Which business view has the main column (null = the campfire itself).
  const [biz, setBiz] = useState<BizId | null>(null)
  const title = biz === 'stats' ? t('account.stats.title') : t('account.title')
  usePageHead(title)
  // Admin "edit another camper" mode: the picked user + its own mobile toggle.
  const [selected, setSelected] = useState<Member | null>(null)
  const [targetOpen, setTargetOpen] = useState(false)
  // Where the admin clicked, in viewport coords — desktop pops the editor
  // there instead of the far right rail (see .account-fields-target in
  // styles.css). Unused on mobile, where the panel stays a static overlay.
  // openUp/maxH keep the popover on-screen: it flips above the click when
  // there isn't room below, and its max-height is capped to whichever side
  // it opens into so it scrolls internally instead of running off-screen.
  const [anchor, setAnchor] = useState<{ x: number; y: number; openUp: boolean; maxH: number } | null>(
    null,
  )
  const isAdmin = me?.role === 'admin'

  // Fold an admin edit back into the circle without a refetch.
  const onSaved = (u: AdminUserSummary) =>
    setMembers((prev) =>
      (prev ?? []).map((m) =>
        m.id === u.id ? { ...m, displayName: u.displayName, avatarUrl: u.avatarUrl, role: u.role } : m,
      ),
    )
  const closeTarget = () => {
    setSelected(null)
    setTargetOpen(false)
    setAnchor(null)
  }

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

  // AccountFields is always mounted — the right rail on desktop (like
  // Reviews/Journal/Compass), reachable only via the .page-head-row title-
  // line toggle on mobile (see the .rail-toggle CSS: hidden above 900px, and
  // .account-fields itself is display:none below 900px unless `fieldsOpen`
  // adds `.is-open`). One tree, breakpoint entirely in CSS — same pattern
  // Reviews/Journal now share for their own Upcoming rail toggle.
  const bizToggles = BUSINESS_TOGGLES.filter((b) => !b.adminOnly || isAdmin)

  return (
    <section className="account-page">
      <div className="page-head-row">
        <h1>{title}</h1>
        <div className="head-toggles">
          {selected && (
            <button
              type="button"
              className={`user-toggle rail-toggle${targetOpen ? ' is-open' : ''}`}
              aria-expanded={targetOpen}
              aria-label={t('account.editUser', { name: selected.displayName })}
              onClick={() => setTargetOpen((o) => !o)}
            >
              <EditIcon />
              <span className="rail-toggle-label">{selected.displayName}</span>
            </button>
          )}
          <button
            type="button"
            className={`user-toggle rail-toggle${fieldsOpen ? ' is-open' : ''}`}
            aria-expanded={fieldsOpen}
            aria-label={t('account.fields.title')}
            onClick={() => setFieldsOpen((o) => !o)}
          >
            <EditIcon />
            <span className="rail-toggle-label">{t('account.fields.title')}</span>
          </button>
          {bizToggles.length > 0 && (
            <div className="biz-toggles" role="group" aria-label={t('account.biz.label')}>
              <span className="biz-label" aria-hidden="true">
                {t('account.biz.label')}
              </span>
              <div className="biz-btns">
                {bizToggles.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className={`biz-toggle${biz === b.id ? ' is-active' : ''}`}
                    aria-pressed={biz === b.id}
                    aria-label={t(b.labelKey)}
                    title={t(b.labelKey)}
                    onClick={() => setBiz((cur) => (cur === b.id ? null : b.id))}
                  >
                    <b.icon />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <p className="muted">{t('account.lead')}</p>

      <div className="reviews-layout">
        <div className="reviews-main">
          {biz === 'stats' ? (
            <div className="stats-main">
              {/* The fire keeps burning up here — and is the way back home. */}
              <button
                type="button"
                className="stats-fire"
                onClick={() => setBiz(null)}
                aria-label={t('account.stats.back')}
                title={t('account.stats.back')}
              >
                <Campfire />
              </button>
              <AccountStats />
            </div>
          ) : (
          <div className="campfire-scene" role="list">
            <Campfire />
            {(members ?? []).map((m, i, all) => {
              // Seats spread evenly around the fire, first seat at the top.
              const angle = (i / all.length) * 2 * Math.PI - Math.PI / 2
              const left = 50 + 41 * Math.cos(angle)
              const top = 50 + 41 * Math.sin(angle)
              // Admins can tap any other camper to open its edit panel; your
              // own seat stays a plain marker (you edit yourself in the rail).
              const editable = isAdmin && !m.you
              const inner = (
                <>
                  <RankGeometry tier={m.role} />
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
                </>
              )
              const style = { left: `${left}%`, top: `${top}%` }
              return editable ? (
                <button
                  key={m.id}
                  type="button"
                  className={`camper camper-editable${selected?.id === m.id ? ' is-selected' : ''}`}
                  style={style}
                  aria-label={t('account.editUser', { name: m.displayName })}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    const margin = 20
                    const spaceBelow = window.innerHeight - rect.bottom
                    const spaceAbove = rect.top
                    const openUp = spaceBelow < 280 && spaceAbove > spaceBelow
                    const maxH = Math.max(160, (openUp ? spaceAbove : spaceBelow) - margin)
                    setAnchor({
                      x: rect.left + rect.width / 2,
                      y: openUp ? rect.top : rect.bottom,
                      openUp,
                      maxH,
                    })
                    setSelected(m)
                    setTargetOpen(true)
                  }}
                >
                  {inner}
                </button>
              ) : (
                <div
                  key={m.id}
                  role="listitem"
                  className={`camper${m.you ? ' is-you' : ''}`}
                  style={style}
                >
                  {inner}
                </div>
              )
            })}
          </div>
          )}

          <div className="account-actions">
            <button type="button" className="btn btn-ghost" onClick={signOut}>
              {t('account.signOut')}
            </button>
          </div>
        </div>

        <AccountFields open={fieldsOpen} />
        {selected && (
          <AccountFields
            key={selected.id}
            target={selected}
            open={targetOpen}
            onClose={closeTarget}
            onSaved={onSaved}
            anchor={anchor}
          />
        )}
      </div>
    </section>
  )
}

// The mobile title-line toggle that reveals AccountFields — a pencil, since
// it opens the edit-your-details form (a settings-cog glyph read too much
// like a sun at this size).
function EditIcon() {
  return (
    <svg className="user-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 16.7V20h3.3L18 9.3a1 1 0 0 0 0-1.4l-1.9-1.9a1 1 0 0 0-1.4 0L4 16.7z" />
      <path d="M13.8 6.9l3.3 3.3" />
    </svg>
  )
}

// The «Твои дела» statistics-toggle glyph — plain bars, no drama.
function ChartIcon() {
  return (
    <svg className="user-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <path d="M4 20h16" />
      <path d="M7 16v-5" />
      <path d="M12 16V7" />
      <path d="M17 16v-8" />
    </svg>
  )
}

// Rank ring by role — a faint Seed-of-Life motif behind the avatar, not a
// mascot on top of it: neutral, family-friendly geometry echoing the site's
// mandala/sacred-geometry look (see CLAUDE.md "Styling & color") rather than
// a game-y border. Six circles of radius r stamped around a center circle of
// the same radius (the classic seed-of-life construction) via the mandala
// generator's own "rotated <use> around a center" trick — one circle drawn
// once in <defs>, repeated by rotation instead of by hand. It renders BEHIND
// the avatar (see .rank-geometry in styles.css: no z-index, so the avatar's
// opaque background naturally paints over its center) — only the parts of
// the circles that fall outside the avatar's own radius show, as a faint
// halo just past its edge.
const RANK_TINTS: Record<Role, string> = {
  viewer: '#9aa5b1',
  editor: '#c9a227',
  admin: '#5fb8d9',
}

function RankGeometry({ tier }: { tier: Role }) {
  // Every camper renders its own RankGeometry, so a literal id would repeat
  // once per instance — duplicate ids are invalid, and `<use href="#…">`
  // resolving them is implementation-defined. useId() keeps each instance's
  // id unique, same as the diagram renderer's per-instance id uniquification.
  const uid = useId()
  const circleId = `rank-circle-${uid}`
  const tint = RANK_TINTS[tier]
  return (
    <svg
      className={`rank-geometry rank-geometry-${tier}`}
      viewBox="0 0 120 120"
      aria-hidden="true"
    >
      <defs>
        <circle id={circleId} cx="60" cy="30" r="30" />
      </defs>
      <g fill="none" stroke={tint} strokeWidth="1">
        <use href={`#${circleId}`} />
        {[60, 120, 180, 240, 300].map((a) => (
          <use key={a} href={`#${circleId}`} transform={`rotate(${a} 60 60)`} />
        ))}
        <circle cx="60" cy="60" r="30" />
        <circle cx="60" cy="60" r="57" />
      </g>
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
