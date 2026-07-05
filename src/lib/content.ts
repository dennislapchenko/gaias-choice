import { parse as parseYaml } from 'yaml'
import { marked } from 'marked'
import { withBaseHtml } from './asset'
import themesRaw from '../../content/themes.yaml?raw'
import type { Entry, Guide, Page, Product, SiteConfig, Theme } from './types'
import type { Locale } from './i18n'

marked.setOptions({ gfm: true, breaks: false })

// Palettes are shared across locales — not translated.
export const themes = parseYaml(themesRaw) as Theme[]
export const defaultTheme = themes.find((t) => t.default) ?? themes[0]

/** Split `---`-delimited yaml frontmatter from the markdown body. */
function parseFrontmatter(raw: string): { data: Record<string, unknown>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw)
  if (!match) return { data: {}, body: raw }
  return { data: (parseYaml(match[1]) as Record<string, unknown>) ?? {}, body: match[2] }
}

/** Pulls the `<locale>` and slug out of a `.../content/locales/<locale>/<kind>/<slug>.md` path. */
function localeAndSlugFromPath(path: string, kind: string): { locale: string; slug: string } {
  const match = new RegExp(`content/locales/([^/]+)/${kind}/([^/]+)\\.md$`).exec(path)
  return { locale: match?.[1] ?? 'en', slug: match?.[2] ?? path }
}

function loadCollection<T extends Entry>(
  modules: Record<string, string>,
  kind: string,
): Partial<Record<Locale, T[]>> {
  const grouped: Partial<Record<Locale, T[]>> = {}
  for (const [path, raw] of Object.entries(modules)) {
    const { locale, slug } = localeAndSlugFromPath(path, kind)
    const { data, body } = parseFrontmatter(raw)
    const entry = { slug, ...data, html: withBaseHtml(marked.parse(body) as string) } as T
    ;(grouped[locale as Locale] ??= []).push(entry)
  }
  return grouped
}

const byDateDesc = (a: { date?: string }, b: { date?: string }) =>
  (b.date ?? '').localeCompare(a.date ?? '')

function sortByDate(grouped: Partial<Record<Locale, { date?: string }[]>>): void {
  for (const list of Object.values(grouped)) list?.sort(byDateDesc)
}

/** Falls back to the English list when a locale has no entries at all yet. */
function collectionFor<T>(grouped: Partial<Record<Locale, T[]>>, locale: Locale): T[] {
  const list = grouped[locale]
  return list && list.length > 0 ? list : (grouped.en ?? [])
}

/** Falls back to the English entry when a locale is missing this one slug. */
function entryFor<T extends Entry>(
  grouped: Partial<Record<Locale, T[]>>,
  locale: Locale,
  slug: string,
): T | undefined {
  return (
    (grouped[locale] ?? []).find((e) => e.slug === slug) ??
    (grouped.en ?? []).find((e) => e.slug === slug)
  )
}

// Eager glob = content is bundled at build time; no runtime fetch, no server needed.
// The locale segment is a wildcard so adding content/locales/<lng>/... needs no code change.
const siteModules = import.meta.glob('../../content/locales/*/site.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const productModules = import.meta.glob('../../content/locales/*/products/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const guideModules = import.meta.glob('../../content/locales/*/guides/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const pageModules = import.meta.glob('../../content/locales/*/pages/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const siteByLocale: Partial<Record<Locale, SiteConfig>> = {}
for (const [path, raw] of Object.entries(siteModules)) {
  const match = /content\/locales\/([^/]+)\/site\.yaml$/.exec(path)
  siteByLocale[(match?.[1] ?? 'en') as Locale] = parseYaml(raw) as SiteConfig
}

const productsByLocale = loadCollection<Product>(productModules, 'products')
const guidesByLocale = loadCollection<Guide>(guideModules, 'guides')
const pagesByLocale = loadCollection<Page>(pageModules, 'pages')
sortByDate(productsByLocale)
sortByDate(guidesByLocale)

export const getSite = (locale: Locale): SiteConfig => siteByLocale[locale] ?? siteByLocale.en!

export const getProducts = (locale: Locale): Product[] => collectionFor(productsByLocale, locale)
export const getGuides = (locale: Locale): Guide[] => collectionFor(guidesByLocale, locale)
export const getPages = (locale: Locale): Page[] => collectionFor(pagesByLocale, locale)

export const getProduct = (locale: Locale, slug: string) => entryFor(productsByLocale, locale, slug)
export const getGuide = (locale: Locale, slug: string) => entryFor(guidesByLocale, locale, slug)
export const getPage = (locale: Locale, slug: string) => entryFor(pagesByLocale, locale, slug)
