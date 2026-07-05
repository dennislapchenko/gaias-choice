import { useMemo, useState } from 'react'
import { eventsForMonth } from '../lib/astro'
import { useI18n } from '../lib/i18n'
import type { AstroEvent } from '../lib/types'

// Localized via Intl (not the UI dictionary) so new locales get correct
// month/weekday names automatically, with zero translation work.
const REFERENCE_SUNDAY = new Date(2000, 0, 2) // 2000-01-02 is a Sunday

function monthNames(locale: string): string[] {
  const fmt = new Intl.DateTimeFormat(locale, { month: 'long' })
  return Array.from({ length: 12 }, (_, m) => fmt.format(new Date(2000, m, 1)))
}

function weekdayNames(locale: string): string[] {
  const fmt = new Intl.DateTimeFormat(locale, { weekday: 'narrow' })
  return Array.from({ length: 7 }, (_, i) =>
    fmt.format(new Date(REFERENCE_SUNDAY.getFullYear(), REFERENCE_SUNDAY.getMonth(), REFERENCE_SUNDAY.getDate() + i)),
  )
}

const key = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

export default function AstroCalendar() {
  const { locale, t } = useI18n()
  const months = useMemo(() => monthNames(locale), [locale])
  const weekdays = useMemo(() => weekdayNames(locale), [locale])
  const prettyDate = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(
      new Date(y, m - 1, d),
    )
  }

  const today = new Date()
  const todayKey = key(today.getFullYear(), today.getMonth(), today.getDate())

  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() })
  const [activeKey, setActiveKey] = useState<string | null>(null)

  // Computed fresh per month from real ephemeris positions (see lib/astro.ts).
  const eventsByDate = useMemo(() => {
    const map: Record<string, AstroEvent[]> = {}
    for (const e of eventsForMonth(view.y, view.m, locale)) (map[e.date] ??= []).push(e)
    return map
  }, [view.y, view.m, locale])

  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const startOffset = new Date(view.y, view.m, 1).getDay()

  const cells: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const monthEventKeys = cells
    .filter((d): d is number => d !== null)
    .map((d) => key(view.y, view.m, d))
    .filter((k) => eventsByDate[k])

  // What the detail panel shows: hovered day → today (if in view) → first event.
  const shownKey =
    activeKey && eventsByDate[activeKey]
      ? activeKey
      : monthEventKeys.includes(todayKey)
        ? todayKey
        : monthEventKeys[0]
  const shownEvents = shownKey ? eventsByDate[shownKey] : []

  const move = (delta: number) => {
    const dt = new Date(view.y, view.m + delta, 1)
    setView({ y: dt.getFullYear(), m: dt.getMonth() })
    setActiveKey(null)
  }

  return (
    <div className="astro-cal">
      <div className="astro-cal-head">
        <button type="button" onClick={() => move(-1)} aria-label={t('astro.prevMonth')}>
          ‹
        </button>
        <strong>
          {months[view.m]} {view.y}
        </strong>
        <button type="button" onClick={() => move(1)} aria-label={t('astro.nextMonth')}>
          ›
        </button>
      </div>

      <div className="astro-grid astro-weekdays" aria-hidden="true">
        {weekdays.map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>

      <div className="astro-grid">
        {cells.map((d, i) => {
          if (d === null) return <span key={i} className="astro-cell empty" />
          const k = key(view.y, view.m, d)
          const evs = eventsByDate[k]
          const cls = [
            'astro-cell',
            evs ? 'has-events' : '',
            k === todayKey ? 'is-today' : '',
            k === shownKey ? 'is-active' : '',
          ]
            .join(' ')
            .trim()
          return (
            <button
              key={i}
              type="button"
              className={cls}
              disabled={!evs}
              onMouseEnter={() => evs && setActiveKey(k)}
              onFocus={() => evs && setActiveKey(k)}
              onClick={() => evs && setActiveKey(k)}
              aria-label={
                evs ? t('astro.cellAriaLabel', { day: d, events: evs.map((e) => e.title).join(', ') }) : String(d)
              }
            >
              <span className="astro-daynum">{d}</span>
              {evs && (
                <span className="astro-icons" aria-hidden="true">
                  {evs.slice(0, 2).map((e, j) => (
                    <span key={j}>{e.icon}</span>
                  ))}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {shownEvents.length > 0 ? (
        <div className="astro-panel" aria-live="polite">
          <div className="astro-panel-date">{prettyDate(shownKey!)}</div>
          {shownEvents.map((e, j) => (
            <div key={j} className="astro-panel-event">
              <span className="astro-panel-icon" aria-hidden="true">
                {e.icon}
              </span>
              <div>
                <div className="astro-panel-title">{e.title}</div>
                <div className="astro-panel-meta">
                  {e.time ? `${e.time} · ` : ''}
                  {e.body}
                </div>
                <div className="astro-panel-blurb">{e.blurb}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="astro-empty muted">{t('astro.noEvents')}</p>
      )}

      <p className="astro-note muted">{t('astro.note')}</p>
    </div>
  )
}
