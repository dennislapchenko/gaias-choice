// Build-time server entry. scripts/prerender.mjs imports the `vite build
// --ssr` bundle of this file (dist-server/entry-server.js) to render every
// route of both locale trees into real HTML plus the per-page head data.
// Never part of the browser bundle.
//
// The static route list below mirrors App.tsx's route table — change one,
// change the other. Everything else derives from the same content getters the
// running site uses, so content edits reshape the manifest with no code edit.
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import App from './App'
import {
  DEFAULT_LOCALE,
  I18nProvider,
  SUPPORTED_LOCALES,
  localeFromRest,
  translate,
  type Locale,
} from './lib/i18n'
import {
  getCompass,
  getJournal,
  getPage,
  getProducts,
  getSite,
  getUpcomingJournal,
  getUpcomingProducts,
} from './lib/content'

const BASE = import.meta.env.BASE_URL

export interface PageDef {
  /** App path incl. locale prefix, no Vite base: '/reviews', '/en/reviews/x'. */
  path: string
  /** Locale-less route — pairs the ru/en siblings for hreflang. */
  key: string
  locale: Locale
  title: string
  description: string
  ogType: 'website' | 'article'
  /** WIP content or a utility shell — kept out of the index and the sitemap. */
  noindex: boolean
  sitemap: boolean
  lastmod?: string
  /** Utility route whose content is session-driven: emit the empty app shell. */
  shell?: boolean
}

/** Every prerenderable page of one locale's URL tree. */
export function pages(locale: Locale): PageDef[] {
  const site = getSite(locale)
  const t = (key: string) => translate(locale, key)
  const prefix = locale === DEFAULT_LOCALE ? '' : `/${locale}`
  // Same composition rule as lib/head.tsx (the client-side updater).
  const fullTitle = (title?: string) =>
    title ? `${title} — ${site.name}` : `${site.name} — ${site.tagline}`

  const defs: PageDef[] = []
  const add = (
    key: string,
    meta: Partial<Omit<PageDef, 'path' | 'key' | 'locale'>> = {},
  ) =>
    defs.push({
      path: (prefix + (key === '/' ? '' : key)) || '/',
      key,
      locale,
      title: fullTitle(meta.title),
      description: meta.description || site.description,
      ogType: meta.ogType ?? 'website',
      noindex: meta.noindex ?? false,
      sitemap: meta.sitemap ?? false,
      lastmod: meta.lastmod,
      shell: meta.shell,
    })

  // Home + listings.
  add('/', { sitemap: true })
  add('/reviews', { title: t('reviews.title'), description: t('reviews.lead'), sitemap: true })
  add('/journal', { title: t('journal.title'), description: t('journal.lead'), sitemap: true })
  add('/compass', { title: t('compass.title'), description: t('compass.lead'), sitemap: true })

  // Standalone pages wired as routes in App.tsx.
  for (const slug of ['about', 'contact', 'roadmap', 'disclosure', 'privacy', 'support']) {
    add(`/${slug}`, { title: getPage(locale, slug)?.title, sitemap: true })
  }

  // Utility routes: must exist as files so they return 200 (magic-link emails
  // land on /magic), never indexed, content is session-driven client-side.
  add('/magic', { noindex: true, shell: true })
  add('/account', { title: t('account.title'), noindex: true, shell: true })

  // Detail pages. Upcoming posts are previewable-but-WIP: real files (their
  // rail links must not 404) with noindex until flipped active.
  for (const p of getProducts(locale))
    add(`/reviews/${p.slug}`, { title: p.title, description: p.excerpt, ogType: 'article', sitemap: true, lastmod: p.date })
  for (const p of getUpcomingProducts(locale))
    add(`/reviews/${p.slug}`, { title: p.title, description: p.excerpt, ogType: 'article', noindex: true })
  for (const e of getJournal(locale))
    add(`/journal/${e.slug}`, { title: e.title, description: e.excerpt, ogType: 'article', sitemap: true, lastmod: e.date })
  for (const e of getUpcomingJournal(locale))
    add(`/journal/${e.slug}`, { title: e.title, description: e.excerpt, ogType: 'article', noindex: true })
  for (const c of getCompass(locale))
    add(`/compass/${c.slug}`, { title: c.title, description: c.excerpt, ogType: 'article', sitemap: true, lastmod: c.date })

  return defs
}

/** The 404 page's head (rendered once, in the default locale, as dist/404.html). */
export function notFoundMeta(): { title: string; description: string; locale: Locale } {
  const site = getSite(DEFAULT_LOCALE)
  return {
    title: `${translate(DEFAULT_LOCALE, 'notFound.title')} — ${site.name}`,
    description: site.description,
    locale: DEFAULT_LOCALE,
  }
}

/** Render one app path (locale prefix included, no base) to body HTML. The
 *  basename mirrors main.tsx, so prerendered anchors carry base + locale. */
export function render(path: string): { html: string; locale: Locale } {
  const locale = localeFromRest(path.replace(/^\//, ''))
  const basename = (BASE + (locale === DEFAULT_LOCALE ? '' : locale)).replace(/\/+$/, '') || '/'
  const location = BASE.replace(/\/$/, '') + path || '/'
  const html = renderToString(
    <StaticRouter location={location} basename={basename}>
      <I18nProvider locale={locale}>
        <App />
      </I18nProvider>
    </StaticRouter>,
  )
  return { html, locale }
}

/** Absolute-URL origin (site.yaml `url:`, subpath included) + brand name. */
export function siteMeta(): { url: string; name: string } {
  const site = getSite('en')
  return { url: (site.url ?? '').replace(/\/$/, ''), name: site.name }
}

export { SUPPORTED_LOCALES, DEFAULT_LOCALE }
export { themes, defaultTheme, defaultDarkTheme } from './lib/content'
export { themeCss } from './lib/theme'
