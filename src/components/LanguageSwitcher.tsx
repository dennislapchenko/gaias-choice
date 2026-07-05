import { useEffect, useRef, useState } from 'react'
import { LOCALE_LABELS, SUPPORTED_LOCALES, useI18n, type Locale } from '../lib/i18n'

export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close the menu on outside click or Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const select = (next: Locale) => {
    setLocale(next)
    setOpen(false)
  }

  return (
    <div className="lang-switcher" ref={ref}>
      <button
        type="button"
        className="lang-toggle"
        aria-haspopup="listbox"
        aria-expanded={open}
        title={t('lang.changeTitle')}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="lang-toggle-code" aria-hidden="true">
          {locale.toUpperCase()}
        </span>
        <span className="lang-toggle-label">{t('lang.toggleLabel')}</span>
      </button>

      {open && (
        <ul className="lang-menu" role="listbox" aria-label={t('lang.menuAriaLabel')}>
          {SUPPORTED_LOCALES.map((code) => (
            <li key={code}>
              <button
                type="button"
                role="option"
                aria-selected={code === locale}
                className={`lang-option ${code === locale ? 'is-active' : ''}`}
                onClick={() => select(code)}
              >
                <span className="lang-option-code" aria-hidden="true">
                  {code.toUpperCase()}
                </span>
                <span className="lang-option-text">
                  <span className="lang-label">{LOCALE_LABELS[code]}</span>
                </span>
                {code === locale && (
                  <span className="lang-check" aria-hidden="true">
                    ✓
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
