import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
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

function isLocale(value: string | null): value is Locale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

function getStoredLocale(): Locale | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return isLocale(value) ? value : null
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

export function initialLocale(): Locale {
  return getStoredLocale() ?? DEFAULT_LOCALE
}

/** Set <html lang> before first render, mirroring initTheme()'s flash-prevention pattern. */
export function initI18n(): void {
  document.documentElement.lang = initialLocale()
}

type Translate = (key: string, vars?: Record<string, string | number>) => string

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: Translate
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale)

  const setLocale = (next: Locale) => {
    storeLocale(next)
    document.documentElement.lang = next
    setLocaleState(next)
  }

  const t = useMemo<Translate>(() => {
    const dict = dictionaries[locale]
    return (key, vars) => {
      const template = dict[key] ?? dictionaries.en[key] ?? key
      if (!vars) return template
      return Object.entries(vars).reduce(
        (str, [name, value]) => str.replaceAll(`{{${name}}}`, String(value)),
        template,
      )
    }
  }, [locale])

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
