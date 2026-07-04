import { defaultTheme, themes } from './content'
import type { Theme, ThemeColors } from './types'

const STORAGE_KEY = 'gc-theme'

// Maps each theme color slot to the CSS variable it overrides in styles.css.
const CSS_VARS: Record<keyof ThemeColors, string> = {
  sage: '--sage',
  sageDark: '--sage-dark',
  onAccent: '--on-accent',
  clay: '--clay',
  sand: '--sand',
  sand2: '--sand-2',
  line: '--line',
  mint: '--mint',
  peach: '--peach',
  lilac: '--lilac',
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  ;(Object.keys(CSS_VARS) as (keyof ThemeColors)[]).forEach((key) => {
    root.style.setProperty(CSS_VARS[key], theme.colors[key])
  })
  root.dataset.theme = theme.tag
}

export function resolveTheme(tag: string | null): Theme {
  return themes.find((t) => t.tag === tag) ?? defaultTheme
}

function getStoredTag(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function storeThemeTag(tag: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, tag)
  } catch {
    /* storage unavailable (private mode etc.) — non-fatal */
  }
}

/** Apply the stored (or default) theme. Call before first render to avoid a flash. */
export function initTheme(): Theme {
  const theme = resolveTheme(getStoredTag())
  applyTheme(theme)
  return theme
}

export function initialThemeTag(): string {
  return resolveTheme(getStoredTag()).tag
}
