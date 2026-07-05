import { useEffect, useRef, useState } from 'react'
import { LOCALE_FLAGS, LOCALE_LABELS, SUPPORTED_LOCALES, useI18n } from '../lib/i18n'

// A flag-emoji button that cycles to the next locale on click — no menu. A small
// hint flashes the next language's flag after a click (and shows it on hover), so
// it's clear where another click leads.
export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n()
  const [flash, setFlash] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  const idx = SUPPORTED_LOCALES.indexOf(locale)
  const next = SUPPORTED_LOCALES[(idx + 1) % SUPPORTED_LOCALES.length]

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const cycle = () => {
    setLocale(next)
    setFlash(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setFlash(false), 1100)
  }

  return (
    <div className="lang-switcher">
      <button
        type="button"
        className="lang-toggle"
        onClick={cycle}
        aria-label={t('lang.changeTitle')}
        title={LOCALE_LABELS[next]}
      >
        <span className="lang-flag" aria-hidden="true">
          {LOCALE_FLAGS[locale]}
        </span>
      </button>
      <span className={`lang-hint${flash ? ' show' : ''}`} aria-hidden="true">
        <span className="lang-hint-arrow">→</span>
        {LOCALE_FLAGS[next]}
      </span>
    </div>
  )
}
