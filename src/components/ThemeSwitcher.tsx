import { useEffect, useRef, useState } from 'react'
import { themes } from '../lib/content'
import { useI18n } from '../lib/i18n'
import { applyTheme, initialThemeTag, resolveTheme, storeThemeTag } from '../lib/theme'

export default function ThemeSwitcher() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [activeTag, setActiveTag] = useState(initialThemeTag)
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

  const select = (tag: string) => {
    const theme = resolveTheme(tag)
    applyTheme(theme)
    storeThemeTag(tag)
    setActiveTag(tag)
    setOpen(false)
  }

  const active = themes.find((theme) => theme.tag === activeTag)

  return (
    <div className="theme-switcher" ref={ref}>
      <button
        type="button"
        className="theme-toggle"
        aria-haspopup="listbox"
        aria-expanded={open}
        title={t('theme.changeTitle')}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="theme-dots" aria-hidden="true">
          <i style={{ background: active?.colors.sage }} />
          <i style={{ background: active?.colors.peach }} />
          <i style={{ background: active?.colors.lilac }} />
        </span>
        <span className="theme-toggle-label">{t('theme.toggleLabel')}</span>
      </button>

      {open && (
        <ul className="theme-menu" role="listbox" aria-label={t('theme.menuAriaLabel')}>
          {themes.map((theme) => (
            <li key={theme.tag}>
              <button
                type="button"
                role="option"
                aria-selected={theme.tag === activeTag}
                className={`theme-option ${theme.tag === activeTag ? 'is-active' : ''}`}
                onClick={() => select(theme.tag)}
              >
                <span className="theme-dots" aria-hidden="true">
                  <i style={{ background: theme.colors.sage }} />
                  <i style={{ background: theme.colors.mint }} />
                  <i style={{ background: theme.colors.peach }} />
                  <i style={{ background: theme.colors.lilac }} />
                </span>
                <span className="theme-option-text">
                  <span className="theme-label">{theme.label}</span>
                  <span className="theme-tag">
                    {theme.tag}
                    {theme.default ? ` · ${t('theme.default')}` : ''}
                  </span>
                </span>
                {theme.tag === activeTag && (
                  <span className="theme-check" aria-hidden="true">
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
