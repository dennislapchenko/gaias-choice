import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getJournal, getJournalTemplate, getUpcomingJournal } from '../lib/content'
import { usePageHead } from '../lib/head'
import { useI18n } from '../lib/i18n'
import JournalRow from '../components/JournalRow'
import Upcoming, { UpcomingIcon } from '../components/Upcoming'

const yearOf = (date?: string) => (date ?? '').slice(0, 4)

// Deliberately the same shape as Reviews.tsx: chip filters above the list
// (years here, categories there) and the "in the works" rail on the right.
export default function Journal() {
  const { locale, t } = useI18n()
  usePageHead(t('journal.title'), t('journal.lead'))
  const entries = getJournal(locale) // already date-descending, active only (content.ts)
  const upcoming = getUpcomingJournal(locale)
  const [upcomingOpen, setUpcomingOpen] = useState(false)

  // Distinct years, newest first — the filter chips.
  const years = [...new Set(entries.map((e) => yearOf(e.date)).filter(Boolean))].sort((a, b) =>
    b.localeCompare(a),
  )

  // The active year lives in the URL (`?year=`), mirroring Reviews' `?category=`.
  const [params, setParams] = useSearchParams()
  const requested = params.get('year')
  const active = requested && years.includes(requested) ? requested : undefined // undefined = all
  const setActive = (y?: string) => setParams(y ? { year: y } : {}, { replace: true })

  const visible = active ? entries.filter((e) => yearOf(e.date) === active) : entries

  return (
    <>
      <header className="page-head">
        <div className="page-head-row">
          <h1>{t('journal.title')}</h1>
          {upcoming.length > 0 && (
            <button
              type="button"
              className={`user-toggle rail-toggle${upcomingOpen ? ' is-open' : ''}`}
              aria-expanded={upcomingOpen}
              aria-label={t('journal.upcomingTitle')}
              onClick={() => setUpcomingOpen((o) => !o)}
            >
              <UpcomingIcon />
            </button>
          )}
        </div>
        <p className="lead">{t('journal.lead')}</p>
      </header>

      <div className="reviews-layout">
        <div className="reviews-main">
          {years.length > 0 && (
            <div className="filters" role="tablist" aria-label={t('journal.yearsAriaLabel')}>
              <button
                role="tab"
                aria-selected={active === undefined}
                className={`chip ${active === undefined ? 'chip-active' : ''}`}
                onClick={() => setActive(undefined)}
              >
                {t('journal.allYears')}
              </button>
              {years.map((y) => (
                <button
                  key={y}
                  role="tab"
                  aria-selected={active === y}
                  className={`chip ${active === y ? 'chip-active' : ''}`}
                  onClick={() => setActive(y)}
                >
                  {y}
                </button>
              ))}
            </div>
          )}

          <div className="journal-list">
            {visible.length > 0 ? (
              visible.map((e) => <JournalRow key={e.slug} entry={e} />)
            ) : (
              <p className="muted">{t('journal.empty')}</p>
            )}
          </div>
        </div>

        <Upcoming
          title={t('journal.upcomingTitle')}
          note={t('journal.upcomingNote')}
          items={upcoming}
          open={upcomingOpen}
          draft={{ dir: 'journal', detailBase: '/journal', template: getJournalTemplate(locale) }}
        />
      </div>
    </>
  )
}
