#!/usr/bin/env node
// Build-time prerender: renders every route of both locale trees into real
// HTML files (dist/<path>.html — GitHub Pages serves extensionless URLs from
// them with 200s and no redirect hop), plus a real 404.html, sitemap.xml and
// robots.txt — all derived from the entry-server manifest, which derives from
// content/. Runs last in `npm run build` (after the client + SSR builds).
// Node-only, zero dependencies.
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  defaultDarkTheme,
  defaultTheme,
  notFoundMeta,
  pages,
  render,
  siteMeta,
  themeCss,
  themes,
} = await import(join(root, 'dist-server/entry-server.js'))

const template = readFileSync(join(dist, 'index.html'), 'utf8')
const { url: ORIGIN, name: SITE_NAME } = siteMeta()
if (!ORIGIN) throw new Error('prerender: site.yaml `url:` is empty — canonical URLs need it')

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\s+/g, ' ')
    .trim()

/** replace() that throws when the marker is missing — a silent miss would
 *  ship every page with the wrong head. (Checks presence, not change, so a
 *  replacement identical to the original — the shell pages — still passes.) */
function mustReplace(doc, pattern, replacement) {
  const found = typeof pattern === 'string' ? doc.includes(pattern) : pattern.test(doc)
  if (!found) throw new Error(`prerender: template marker not found: ${pattern}`)
  return doc.replace(pattern, replacement)
}

// One CSS rule per palette + a pre-paint script that applies the saved (or
// OS-matching) palette tag — so a returning dark-palette visitor never sees
// the light fallback flash before JS loads. lib/theme.ts re-applies the same
// values on boot; the inline rule just covers the first paint.
const paletteCss = themes.map((t) => `html[data-theme="${t.tag}"]{${themeCss(t)}}`).join('\n')
const knownTags = JSON.stringify(themes.map((t) => t.tag))
const paletteBoot =
  `<script>(function(){try{var t=localStorage.getItem('gc-theme');` +
  `if(${knownTags}.indexOf(t)<0)t=matchMedia('(prefers-color-scheme: dark)').matches` +
  `?${JSON.stringify(defaultDarkTheme.tag)}:${JSON.stringify(defaultTheme.tag)};` +
  `document.documentElement.setAttribute('data-theme',t)}catch(e){}})()</script>`
const paletteBlock = `<style>\n${paletteCss}\n</style>\n${paletteBoot}`

const OG_LOCALE = { ru: 'ru_RU', en: 'en_GB' }
const absolute = (path) => ORIGIN + (path === '/' ? '/' : path)
const fileFor = (path) => (path === '/' ? 'index.html' : `${path.slice(1)}.html`)

/** Head extras per page: canonical, robots, hreflang pair, OG/Twitter. */
function headFor(def, siblings) {
  const canonical = absolute(def.path)
  const lines = [`<link rel="canonical" href="${canonical}" />`]
  if (def.noindex) lines.push('<meta name="robots" content="noindex" />')
  const pair = siblings.get(def.key)
  if (pair && pair.ru && pair.en) {
    lines.push(`<link rel="alternate" hreflang="ru" href="${absolute(pair.ru)}" />`)
    lines.push(`<link rel="alternate" hreflang="en" href="${absolute(pair.en)}" />`)
    lines.push(`<link rel="alternate" hreflang="x-default" href="${absolute(pair.ru)}" />`)
  }
  lines.push(`<meta property="og:site_name" content="${esc(SITE_NAME)}" />`)
  lines.push(`<meta property="og:type" content="${def.ogType}" />`)
  lines.push(`<meta property="og:title" content="${esc(def.title)}" />`)
  lines.push(`<meta property="og:description" content="${esc(def.description)}" />`)
  lines.push(`<meta property="og:url" content="${canonical}" />`)
  lines.push(`<meta property="og:image" content="${ORIGIN}/og-default.jpg" />`)
  lines.push(`<meta property="og:locale" content="${OG_LOCALE[def.locale]}" />`)
  lines.push('<meta name="twitter:card" content="summary_large_image" />')
  return lines.join('\n')
}

function writePage(outFile, def, bodyHtml, headExtras) {
  let doc = template
  doc = mustReplace(doc, /<html lang="[^"]*">/, `<html lang="${def.locale}">`)
  doc = mustReplace(doc, /<title>[\s\S]*?<\/title>/, `<title>${esc(def.title)}</title>`)
  doc = mustReplace(
    doc,
    /<meta\s+name="description"[\s\S]*?\/>/,
    `<meta name="description" content="${esc(def.description)}" />`,
  )
  doc = mustReplace(doc, '</head>', `${headExtras}\n${paletteBlock}\n</head>`)
  doc = mustReplace(doc, '<div id="root"></div>', `<div id="root">${bodyHtml}</div>`)
  const file = join(dist, outFile)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, doc)
}

const defs = SUPPORTED_LOCALES.flatMap((locale) => pages(locale))
const siblings = new Map()
for (const def of defs) {
  const pair = siblings.get(def.key) ?? {}
  pair[def.locale] = def.path
  siblings.set(def.key, pair)
}

for (const def of defs) {
  const body = def.shell ? '' : render(def.path).html
  writePage(fileFor(def.path), def, body, headFor(def, siblings))
}

// A real 404 page (any unknown path → the * route → NotFound), replacing the
// old copy-of-index hack. It still boots the SPA, so navigation works from it.
const nf = notFoundMeta()
writePage(
  '404.html',
  { ...nf, ogType: 'website', noindex: true, path: '/404', key: '/404' },
  render(`/__gc-not-found-${Date.now()}__`).html,
  '<meta name="robots" content="noindex" />',
)

// Where a page path is also a directory ('/en', '/reviews', …), mirror the
// page into <dir>/index.html so the trailing-slash form of a typed URL works
// too (Pages would otherwise 404 on '/reviews/'). Canonical still points at
// the slash-less form, so the duplicate is invisible to indexing.
for (const def of defs) {
  const dir = join(dist, def.path.slice(1) || '.')
  if (def.path !== '/' && existsSync(dir) && statSync(dir).isDirectory()) {
    copyFileSync(join(dist, fileFor(def.path)), join(dir, 'index.html'))
  }
}

// sitemap.xml — indexable, finished pages only — and robots.txt (script-owned;
// there is deliberately no public/robots.txt).
const listed = defs.filter((d) => d.sitemap && !d.noindex)
const urls = listed.map(
  (d) =>
    `  <url><loc>${absolute(d.path)}</loc>${d.lastmod ? `<lastmod>${d.lastmod}</lastmod>` : ''}</url>`,
)
writeFileSync(
  join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
)
writeFileSync(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`)

// Self-check: every sitemap URL must exist as a written file.
for (const d of listed) {
  if (!existsSync(join(dist, fileFor(d.path)))) {
    throw new Error(`prerender: sitemap lists ${d.path} but ${fileFor(d.path)} was not written`)
  }
}
console.log(`prerender: ${defs.length + 1} pages written, ${listed.length} in sitemap`)
