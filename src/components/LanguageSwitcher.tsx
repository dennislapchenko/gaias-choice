import { useState } from 'react'
import { LOCALE_FLAGS, LOCALE_LABELS, SUPPORTED_LOCALES, useI18n } from '../lib/i18n'

// A flag-emoji button that cycles to the next locale on click — no menu. While
// hovered, the flag flips to the next language's flag (a live preview of where a
// click leads); it reverts to the selected language's flag when the pointer
// leaves.
export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n()
  const [hovered, setHovered] = useState(false)

  const idx = SUPPORTED_LOCALES.indexOf(locale)
  const next = SUPPORTED_LOCALES[(idx + 1) % SUPPORTED_LOCALES.length]
  const shown = hovered ? next : locale

  return (
    <button
      type="button"
      className="lang-toggle"
      onClick={() => setLocale(next)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={t('lang.changeTitle')}
      title={LOCALE_LABELS[next]}
    >
      <span className="lang-flag" aria-hidden="true">
        {LOCALE_FLAGS[shown]}
      </span>
    </button>
  )
}
