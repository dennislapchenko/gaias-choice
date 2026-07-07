import { parse as parseYaml } from 'yaml'
import { marked, Renderer } from 'marked'
import { withBaseHtml } from './asset'
import themesRaw from '../../content/themes.yaml?raw'
import type { CompassEntry, Entry, JournalEntry, Page, PostState, Product, SiteConfig, Theme } from './types'
import type { Locale } from './i18n'

marked.setOptions({ gfm: true, breaks: false })

// Transliterates Cyrillic to Latin so RU headings still get readable, ASCII,
// URL-safe anchor ids (rather than raw percent-encoding).
const CYRILLIC_MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
  й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y',
  ь: '', э: 'e', ю: 'yu', я: 'ya',
}

/** Plain-text heading -> a stable, URL-safe, lowercase slug (dashes, ASCII).
 *  Exported for the live-edit draft flow (file names from post titles). */
export function slugify(text: string): string {
  const transliterated = text
    .toLowerCase()
    .split('')
    .map((ch) => CYRILLIC_MAP[ch] ?? ch)
    .join('')
  return (
    transliterated
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'section'
  )
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Shared diagram templates: one SVG per diagram in content/shared/diagrams/,
// with {{slot}} tokens where locale text goes. Guides embed them via a
// ```diagram <name> fenced block whose YAML body supplies the slot values
// (including `aria` and `caption`) — so geometry lives once for all locales.
const diagramModules = import.meta.glob('../../content/shared/diagrams/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const diagramTemplates: Record<string, string> = {}
for (const [path, raw] of Object.entries(diagramModules)) {
  const name = /([^/]+)\.svg$/.exec(path)?.[1] ?? path
  diagramTemplates[name] = raw.trim()
}

// SVG ids (arrow markers) are document-global; suffixing per instance keeps
// them unique however many diagrams share a page or a template.
let diagramInstance = 0

/** A visible-in-page error beats a thrown one, which would blank the whole SPA. */
const diagramError = (message: string): string => {
  console.error(`[diagram] ${message}`)
  return `<figure class="diagram"><figcaption>⚠ ${escapeHtml(message)}</figcaption></figure>\n`
}

function renderDiagram(name: string, yamlBody: string): string {
  const template = diagramTemplates[name]
  if (!template) return diagramError(`unknown template "${name}" — expected content/shared/diagrams/${name}.svg`)
  let slots: Record<string, unknown>
  try {
    slots = (parseYaml(yamlBody) as Record<string, unknown>) ?? {}
  } catch (err) {
    return diagramError(`"${name}": bad YAML in slot block — ${String(err)}`)
  }
  const missing: string[] = []
  const suffix = `-i${++diagramInstance}`
  const svg = template
    .replace(/id="([^"]+)"/g, (_, id: string) => `id="${id}${suffix}"`)
    .replace(/url\(#([^)]+)\)/g, (_, id: string) => `url(#${id}${suffix})`)
    .replace(/\{\{([\w-]+)\}\}/g, (_, key: string) => {
      const value = slots[key]
      if (typeof value !== 'string') {
        missing.push(key)
        return ''
      }
      return escapeHtml(value)
    })
  if (missing.length > 0) return diagramError(`"${name}": missing slot(s) ${missing.join(', ')}`)
  if (typeof slots.caption !== 'string') return diagramError(`"${name}": missing "caption" slot`)
  return `<figure class="diagram">\n${svg}\n<figcaption>${escapeHtml(slots.caption)}</figcaption>\n</figure>\n`
}

/**
 * Builds a `marked` renderer that stamps h2/h3 with stable, deduped slug ids
 * (e.g. `#setup`, `#setup-2`) so a per-page table of contents can link/scroll
 * to them. Recent `marked` versions stopped generating heading ids, and each
 * document needs its own dedupe counters, so a fresh renderer is created per
 * `marked.parse()` call (see `loadCollection`).
 */
function headingIdRenderer(): Renderer {
  const renderer = new Renderer()
  const seen = new Map<string, number>()
  renderer.heading = ({ tokens, depth }) => {
    const text = renderer.parser.parseInline(tokens)
    const plain = tokens.map((tok) => tok.raw).join('')
    const base = slugify(plain)
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    const id = count === 0 ? base : `${base}-${count + 1}`
    return `<h${depth} id="${id}">${text}</h${depth}>\n`
  }
  renderer.code = function (token) {
    const match = /^diagram\s+(\S+)\s*$/.exec(token.lang ?? '')
    if (match) return renderDiagram(match[1], token.text)
    return Renderer.prototype.code.call(this, token)
  }
  return renderer
}

// Palettes are shared across locales — not translated.
export const themes = parseYaml(themesRaw) as Theme[]
export const defaultTheme = themes.find((t) => t.default) ?? themes[0]

/** Split `---`-delimited yaml frontmatter from the markdown body. */
function parseFrontmatter(raw: string): { data: Record<string, unknown>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw)
  if (!match) return { data: {}, body: raw }
  return { data: (parseYaml(match[1]) as Record<string, unknown>) ?? {}, body: match[2] }
}

/**
 * Pulls the `<locale>` and slug out of a
 * `.../content/locales/<locale>/<kind>/[<subfolder>/]<slug>.md` path. Compass
 * chapters are grouped into epic subfolders on disk (e.g. `compass/homeopathy/…`)
 * for tidiness, but the subfolder is purely organizational — the slug is always
 * just the filename, so routes and links are unaffected by which folder a
 * chapter lives in. (Journal entries are flat, no subfolder.)
 */
function localeAndSlugFromPath(path: string, kind: string): { locale: string; slug: string } {
  const match = new RegExp(`content/locales/([^/]+)/${kind}/(?:.+/)?([^/]+)\\.md$`).exec(path)
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
    const html = marked.parse(body, { renderer: headingIdRenderer() }) as string
    const entry = { slug, ...data, html: withBaseHtml(html) } as T
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

/**
 * The `state: upcoming` posts for the "in the works" rail. Unlike
 * collectionFor's all-or-nothing fallback, this merges en + the locale BY SLUG
 * (locale wins) — upcoming review stubs live in en/ only (brand names are
 * do-not-translate) and must still show on every locale's rail, while a
 * localized journal stub overrides its en counterpart's title. A slug flipped
 * active in one locale but still upcoming in another stays on that locale's
 * rail — accurate: its translation isn't done yet.
 */
function upcomingFor<T extends Entry & { state?: PostState; date?: string }>(
  grouped: Partial<Record<Locale, T[]>>,
  locale: Locale,
): T[] {
  const merged = new Map((grouped.en ?? []).map((e) => [e.slug, e]))
  for (const e of grouped[locale] ?? []) merged.set(e.slug, e)
  return [...merged.values()].filter((e) => e.state === 'upcoming').sort(byDateDesc)
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

// Compass chapters (courses) — grouped in per-epic subfolders on disk.
const compassModules = import.meta.glob('../../content/locales/*/compass/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

// Journal — a flat, date-ordered blog (no subfolders).
const journalModules = import.meta.glob('../../content/locales/*/journal/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const pageModules = import.meta.glob('../../content/locales/*/pages/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

// Blank entry templates the "Contribute!" copy buttons hand to the owner. One
// raw markdown scaffold per kind and locale
// (content/shared/<kind>-template.<locale>.md), single source of truth — see
// getJournalTemplate / getReviewTemplate.
const templateModules = import.meta.glob('../../content/shared/*-template.*.md', {
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
const compassByLocale = loadCollection<CompassEntry>(compassModules, 'compass')
const journalByLocale = loadCollection<JournalEntry>(journalModules, 'journal')
const pagesByLocale = loadCollection<Page>(pageModules, 'pages')
sortByDate(productsByLocale)
sortByDate(compassByLocale)
sortByDate(journalByLocale)

const templatesByKind: Record<string, Partial<Record<Locale, string>>> = {}
for (const [path, raw] of Object.entries(templateModules)) {
  const match = /([\w-]+)-template\.([^.]+)\.md$/.exec(path)
  if (!match) continue
  ;(templatesByKind[match[1]] ??= {})[match[2] as Locale] = raw
}

const templateFor = (kind: string, locale: Locale): string =>
  templatesByKind[kind]?.[locale] ?? templatesByKind[kind]?.en ?? ''

// Shallow-merge English as the base under the requested locale: a locale's own
// fields win, but anything it omits (e.g. non-localized `support:` payment
// details) falls back to English. This keeps do-not-translate config DRY —
// author it once in en/site.yaml and every locale inherits it.
export const getSite = (locale: Locale): SiteConfig => {
  const en = siteByLocale.en!
  const localized = siteByLocale[locale]
  return localized && localized !== en ? { ...en, ...localized } : en
}

// Listing getters return ACTIVE posts only — `state: upcoming` posts are WIP
// and surface through the getUpcoming* getters instead. By-slug getters below
// stay unfiltered so an upcoming post is previewable at its real URL (the
// detail pages show a WIP tag).
export const getProducts = (locale: Locale): Product[] =>
  collectionFor(productsByLocale, locale).filter((p) => p.state !== 'upcoming')
export const getCompass = (locale: Locale): CompassEntry[] => collectionFor(compassByLocale, locale)
export const getJournal = (locale: Locale): JournalEntry[] =>
  collectionFor(journalByLocale, locale).filter((e) => e.state !== 'upcoming')
export const getPages = (locale: Locale): Page[] => collectionFor(pagesByLocale, locale)

/** WIP reviews for the /reviews "in the works" rail (title-only). */
export const getUpcomingProducts = (locale: Locale): Product[] =>
  upcomingFor(productsByLocale, locale)

/** WIP Journal entries for the /journal "in the works" rail (title-only). */
export const getUpcomingJournal = (locale: Locale): JournalEntry[] =>
  upcomingFor(journalByLocale, locale)

export const getProduct = (locale: Locale, slug: string) => entryFor(productsByLocale, locale, slug)
export const getCompassEntry = (locale: Locale, slug: string) => entryFor(compassByLocale, locale, slug)
export const getJournalEntry = (locale: Locale, slug: string) => entryFor(journalByLocale, locale, slug)
export const getPage = (locale: Locale, slug: string) => entryFor(pagesByLocale, locale, slug)

/** The blank Journal-entry template for the /journal "Contribute!" button (en fallback). */
export const getJournalTemplate = (locale: Locale): string => templateFor('journal', locale)

/** The blank review template for the /reviews "Contribute!" button (en fallback). */
export const getReviewTemplate = (locale: Locale): string => templateFor('review', locale)
