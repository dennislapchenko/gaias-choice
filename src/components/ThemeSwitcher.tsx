import { useEffect, useRef, useState } from 'react'
import { themes } from '../lib/content'
import { applyTheme, initialThemeTag, resolveTheme, storeThemeTag } from '../lib/theme'

export default function ThemeSwitcher() {
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

  const active = themes.find((t) => t.tag === activeTag)

  return (
    <div className="theme-switcher" ref={ref}>
      <button
        type="button"
        className="theme-toggle"
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Change color palette"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="theme-dots" aria-hidden="true">
          <i style={{ background: active?.colors.sage }} />
          <i style={{ background: active?.colors.peach }} />
          <i style={{ background: active?.colors.lilac }} />
        </span>
        <span className="theme-toggle-label">Palette</span>
      </button>

      {open && (
        <ul className="theme-menu" role="listbox" aria-label="Color palette">
          {themes.map((t) => (
            <li key={t.tag}>
              <button
                type="button"
                role="option"
                aria-selected={t.tag === activeTag}
                className={`theme-option ${t.tag === activeTag ? 'is-active' : ''}`}
                onClick={() => select(t.tag)}
              >
                <span className="theme-dots" aria-hidden="true">
                  <i style={{ background: t.colors.sage }} />
                  <i style={{ background: t.colors.mint }} />
                  <i style={{ background: t.colors.peach }} />
                  <i style={{ background: t.colors.lilac }} />
                </span>
                <span className="theme-option-text">
                  <span className="theme-label">{t.label}</span>
                  <span className="theme-tag">
                    {t.tag}
                    {t.default ? ' · default' : ''}
                  </span>
                </span>
                {t.tag === activeTag && (
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
