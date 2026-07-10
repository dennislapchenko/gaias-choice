import { createContext, useContext, useMemo, type ReactNode } from 'react'
import en from '../locales/en'
import ru from '../locales/ru'

// Russian listed first — the owner's requested order for the switcher menu,
// and the default *active* locale (see DEFAULT_LOCALE below).
export const SUPPORTED_LOCALES = ['ru', 'en'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]

export const LOCALE_LABELS: Record<Locale, string> = {
  ru: 'Русский',
  en: 'English',
}

// Flag emoji shown in the language toggle (which cycles locales on click).
export const LOCALE_FLAGS: Record<Locale, string> = {
  ru: '🇷🇺',
  en: '🇬🇧',
}

export const DEFAULT_LOCALE: Locale = 'ru'

const STORAGE_KEY = 'gc-lang'

const dictionaries: Record<Locale, Record<string, string>> = { en, ru }

/** Dictionary lookup shared by the `t()` hook and the prerender's head
 *  resolver (entry-server.tsx), so both derive identical strings. */
export function translate(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const template = dictionaries[locale][key] ?? dictionaries.en[key] ?? key
  if (!vars) return template
  return Object.entries(vars).reduce(
    (str, [name, value]) => str.replaceAll(`{{${name}}}`, String(value)),
    template,
  )
}

// --- Locale lives in the URL ------------------------------------------------
// The EN tree is the same site under an `/en` prefix (`/en`, `/en/reviews/x`);
// RU — the default locale — stays unprefixed. The prefix rides in the router
// basename (set once per page load in main.tsx / entry-server.tsx), so every
// <Link> and navigate() is locale-aware with zero per-link code. Switching
// locale is therefore a real navigation to the sibling URL — which exists as
// a prerendered HTML page. localStorage only remembers the *preference*, used
// for the one root-entry redirect in main.tsx.

const BASE = import.meta.env.BASE_URL // always ends with '/'

/** App path without the Vite base or leading slash: '/gaias-choice/en/x' → 'en/x'. */
export function stripBase(pathname: string): string {
  if (pathname + '/' === BASE) return ''
  return pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname.replace(/^\//, '')
}

/** 'en/reviews' → 'en'; 'reviews' → 'ru'. The URL is the locale authority. */
export function localeFromRest(rest: string): Locale {
  return rest === 'en' || rest.startsWith('en/') ? 'en' : DEFAULT_LOCALE
}

/** The locale of the URL the browser is on (client only). */
export function currentLocale(): Locale {
  return localeFromRest(stripBase(window.location.pathname))
}

/** The stored language *preference* — consulted only for the root redirect. */
export function storedLocale(): Locale | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value && (SUPPORTED_LOCALES as readonly string[]).includes(value) ? (value as Locale) : null
  } catch {
    return null
  }
}

function storeLocale(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    /* storage unavailable (private mode etc.) — non-fatal */
  }
}

/** Set <html lang> before first render, mirroring initTheme()'s flash-prevention pattern. */
export function initI18n(): void {
  document.documentElement.lang = currentLocale()
}

/** Full navigation to the same page in `next`'s URL tree — a real page load on
 *  purpose: the sibling page is prerendered HTML, and a constant basename per
 *  document keeps links and hydration trivially consistent. */
function navigateToLocale(next: Locale): void {
  const { pathname, search, hash } = window.location
  const rest = stripBase(pathname)
  const app = rest === 'en' ? '' : rest.startsWith('en/') ? rest.slice(3) : rest
  const target = next === 'en' ? (app ? `en/${app}` : 'en') : app
  window.location.assign(BASE + target + search + hash)
}

type Translate = (key: string, vars?: Record<string, string | number>) => string

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: Translate
}

const I18nContext = createContext<I18nContextValue | null>(null)

/** `locale` is derived from the URL by the caller: main.tsx passes
 *  currentLocale(), entry-server.tsx the locale of the path being prerendered. */
export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale: (next) => {
        if (next === locale) return
        storeLocale(next)
        navigateToLocale(next)
      },
      t: (key, vars) => translate(locale, key, vars),
    }),
    [locale],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
