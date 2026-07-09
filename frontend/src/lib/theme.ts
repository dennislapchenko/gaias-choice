import { defaultDarkTheme, defaultTheme, themes } from './content'
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
  ink: '--ink',
  muted: '--muted',
  white: '--white',
}

// Light :root defaults for the optional text/surface slots — used when a
// (light) palette omits them, so switching dark→light resets them.
const SLOT_DEFAULTS: Partial<Record<keyof ThemeColors, string>> = {
  ink: '#2f2c27',
  muted: '#6f6a60',
  white: '#ffffff',
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  ;(Object.keys(CSS_VARS) as (keyof ThemeColors)[]).forEach((key) => {
    root.style.setProperty(CSS_VARS[key], theme.colors[key] ?? SLOT_DEFAULTS[key] ?? '')
  })
  // Dark palettes (the ones that set `ink`) sit their card surface almost on top
  // of --sand, so panels read flat. Lift sidebar/rail cards with a faint white
  // overlay in dark mode; in light mode --panel-tint is transparent (no change)
  // and the muted "greyed" surfaces stay a dark-ink wash — they must flip to a
  // white wash in dark, else the dark-on-dark tint vanishes.
  const dark = Boolean(theme.colors.ink)
  root.style.setProperty('--panel-tint', dark ? 'rgba(255, 255, 255, 0.05)' : 'transparent')
  root.style.setProperty('--surface-muted', dark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(47, 44, 39, 0.05)')
  root.style.setProperty('--surface-muted-strong', dark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(47, 44, 39, 0.09)')
  // Danger red lightens on dark palettes so error text/borders stay legible on
  // dark surfaces (the :root default #b3423a is tuned for light backgrounds).
  root.style.setProperty('--danger', dark ? '#e08079' : '#b3423a')
  root.dataset.theme = theme.tag
}

function prefersDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

/** The palette to use when the visitor has no saved preference: their OS theme. */
function systemDefaultTheme(): Theme {
  return prefersDark() ? defaultDarkTheme : defaultTheme
}

export function resolveTheme(tag: string | null): Theme {
  return themes.find((t) => t.tag === tag) ?? systemDefaultTheme()
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
