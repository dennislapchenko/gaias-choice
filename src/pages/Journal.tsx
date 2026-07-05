import { useState } from 'react'
import { getJournal, getJournalTemplate } from '../lib/content'
import { useI18n } from '../lib/i18n'
import JournalRow from '../components/JournalRow'
import CopyButton from '../components/CopyButton'

const yearOf = (date?: string) => (date ?? '').slice(0, 4)

export default function Journal() {
  const { locale, t } = useI18n()
  const entries = getJournal(locale) // already date-descending (content.ts)

  // Distinct years, newest first — the right-rail filter (TOC-like).
  const years = [...new Set(entries.map((e) => yearOf(e.date)).filter(Boolean))].sort((a, b) =>
    b.localeCompare(a),
  )
  const [activeYear, setActiveYear] = useState<string | undefined>(undefined) // undefined = all

  const visible = activeYear ? entries.filter((e) => yearOf(e.date) === activeYear) : entries

  return (
    <>
      <header className="page-head">
        <h1>{t('journal.title')}</h1>
        <p className="lead">{t('journal.lead')}</p>
      </header>

      <div className="journal-layout">
        <div className="journal-main">
          <CopyButton
            value={getJournalTemplate(locale)}
            label={t('journal.templateBtn')}
            className="copy-template-btn"
          />

          <div className="journal-list">
            {visible.length > 0 ? (
              visible.map((e) => <JournalRow key={e.slug} entry={e} />)
            ) : (
              <p className="muted">{t('journal.empty')}</p>
            )}
          </div>
        </div>

        {years.length > 0 && (
          <aside className="journal-years" aria-label={t('journal.yearsAriaLabel')}>
            <button
              type="button"
              className={`journal-year${activeYear === undefined ? ' is-active' : ''}`}
              aria-pressed={activeYear === undefined}
              onClick={() => setActiveYear(undefined)}
            >
              {t('journal.allYears')}
            </button>
            {years.map((y) => (
              <button
                key={y}
                type="button"
                className={`journal-year${activeYear === y ? ' is-active' : ''}`}
                aria-pressed={activeYear === y}
                onClick={() => setActiveYear(y)}
              >
                {y}
              </button>
            ))}
          </aside>
        )}
      </div>
    </>
  )
}
