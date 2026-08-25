#!/usr/bin/env node
// Generates the social-preview ("OG") card for every Compass course, one per
// course per locale: public/og/course-<tag>-<locale>.svg, 1200×630. `task
// og-cards` runs this and then rasterizes the SVGs to .jpg (deleting the SVGs)
// — the .jpg is what `src/entry-server.tsx` references as each course page's
// og:image, so the file names here and there must match.
//
// House style follows scripts/generate-mandala.mjs: Node script, config at the
// top, output committed to the repo. The one dependency is `yaml` (already a
// runtime dep of the site) — the course list is read from content/, not
// duplicated here, so adding a course to site.yaml is all it takes.
//
// HARD CONSTRAINTS of the rasterized-SVG target (learned the hard way — do not
// "clean these up"):
//   * literal hex colors ONLY. `var(--sage)` resolves to nothing in a
//     standalone SVG, so the palette is read from content/themes.yaml here and
//     baked in as hex.
//   * font-family MUST be "DejaVu Sans, sans-serif" — the only family present
//     in the rasterizer container that renders Cyrillic instead of tofu.
//   * SVG has no text wrapping. Lines are measured by approximate glyph width
//     and emitted as separate <text> elements.
//   * FLAT FILLS ONLY — no gradients, no stroked paths. The dpokidov/imagemagick
//     image declares an rsvg delegate but ships no rsvg-convert binary, so
//     ImageMagick falls back to its own MSVG renderer, which silently drops
//     `fill="url(#…)"` (renders black) and `fill="none" stroke="…"` paths
//     (renders nothing). Verified: rect/circle/text fills, per-element and
//     group `opacity`, and `rx` all render correctly. Keep to those.
//
// Usage: node scripts/generate-og-cards.mjs [--only=tag1,tag2]

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CONTENT = join(ROOT, '..', 'content')
const OUT_DIR = join(ROOT, 'public/og')
const LOCALES = ['en', 'ru']

const W = 1200
const H = 630
const PAD = 84
const MAX_TEXT_W = W - PAD * 2
const MAX_LINES = 3
const FONT = 'DejaVu Sans, sans-serif'

// ── palette ──────────────────────────────────────────────────────────────────
// Sourced from the site's default light palette so the cards match the brand.
// Backgrounds are that palette's accents mixed toward black — a card has to
// carry white text at thumbnail size, which no light-palette value does.
function palette() {
  const themes = YAML.parse(readFileSync(join(CONTENT, 'themes.yaml'), 'utf8'))
  const theme = themes.find((t) => t.default) ?? themes[0]
  const c = theme.colors
  return {
    bg: mix(c.sageDark, '#000000', 0.8),
    disc: mix(c.sageDark, '#000000', 0.56),
    accent: c.clay,
    title: c.sand,
    label: c.peach,
    foot: c.sand2,
    motif: c.mint,
  }
}

/** Blend `hex` toward `to` by `amount` (0 = hex, 1 = to). Returns literal hex. */
function mix(hex, to, amount) {
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const [r1, g1, b1] = rgb(hex)
  const [r2, g2, b2] = rgb(to)
  const ch = (a, b) =>
    Math.round(a + (b - a) * amount)
      .toString(16)
      .padStart(2, '0')
  return `#${ch(r1, r2)}${ch(g1, g2)}${ch(b1, b2)}`
}

// ── text measuring (SVG has no auto-wrap) ────────────────────────────────────
const NARROW = new Set([...'ijltIfr.,;:!|()[]{}-\'"'])
const WIDE = new Set([...'MWmw@%ЖШЩФЮ'])
const charWidth = (c) => (c === ' ' ? 0.28 : NARROW.has(c) ? 0.3 : WIDE.has(c) ? 0.92 : 0.58)
const textWidth = (s, size) => [...s].reduce((w, c) => w + charWidth(c), 0) * size

function wrap(text, size, maxWidth) {
  const lines = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word
    if (line && textWidth(next, size) > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines
}

/** Wrap at the largest size that still fits MAX_LINES; ellipsize any overflow. */
function layoutTitle(text) {
  for (const size of [80, 70, 60]) {
    const lines = wrap(text, size, MAX_TEXT_W)
    if (lines.length <= MAX_LINES || size === 60) {
      if (lines.length > MAX_LINES) {
        const kept = lines.slice(0, MAX_LINES)
        let last = `${kept[MAX_LINES - 1]} ${lines.slice(MAX_LINES).join(' ')}`
        while (last && textWidth(`${last}…`, size) > MAX_TEXT_W) last = last.slice(0, -1)
        kept[MAX_LINES - 1] = `${last.trimEnd()}…`
        return { size, lines: kept }
      }
      return { size, lines }
    }
  }
  return { size: 60, lines: [text] }
}

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// ── the card ─────────────────────────────────────────────────────────────────
/** The site's mandala quoted quietly, in the corner opposite the wordmark: a
 *  disc bleeding off the bottom-right with two rings of dots around a center
 *  point. Filled circles only (see the header constraints) — the positions are
 *  computed here rather than drawn with rotate transforms, so nothing depends
 *  on the renderer's transform handling either. */
function motif(colors) {
  const cx = 1105
  const cy = 548
  const ring = (radius, dot, count, fill, opacity) =>
    Array.from({ length: count }, (_, i) => {
      const a = (2 * Math.PI * i) / count - Math.PI / 2
      const x = (cx + radius * Math.cos(a)).toFixed(1)
      const y = (cy + radius * Math.sin(a)).toFixed(1)
      return `    <circle cx="${x}" cy="${y}" r="${dot}" fill="${fill}" opacity="${opacity}"/>`
    }).join('\n')
  return `  <g>
    <circle cx="${cx}" cy="${cy}" r="238" fill="${colors.disc}"/>
${ring(166, 8, 18, colors.motif, 0.5)}
${ring(212, 4, 36, colors.motif, 0.3)}
    <circle cx="${cx}" cy="${cy}" r="17" fill="${colors.accent}" opacity="0.75"/>
  </g>`
}

function renderCard({ label, title, siteName, colors }) {
  const { size, lines } = layoutTitle(title)
  const lineHeight = Math.round(size * 1.16)
  const blockTop = 330 - ((lines.length - 1) * lineHeight) / 2
  const tspans = lines
    .map(
      (l, i) =>
        `  <text x="${PAD}" y="${blockTop + i * lineHeight}" font-family="${FONT}" font-size="${size}" font-weight="bold" fill="${colors.title}">${esc(l)}</text>`,
    )
    .join('\n')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${colors.bg}"/>
${motif(colors)}
  <text x="${PAD}" y="118" font-family="${FONT}" font-size="30" letter-spacing="7" fill="${colors.label}" opacity="0.9">${esc(label.toUpperCase())}</text>
  <rect x="${PAD}" y="150" width="88" height="7" rx="3.5" fill="${colors.accent}"/>
${tspans}
  <text x="${PAD}" y="548" font-family="${FONT}" font-size="32" fill="${colors.foot}" opacity="0.85">${esc(siteName)}</text>
  <rect x="0" y="${H - 12}" width="${W}" height="12" fill="${colors.accent}" opacity="0.9"/>
</svg>
`
}

// ── content sources ──────────────────────────────────────────────────────────
const siteYaml = (locale) =>
  YAML.parse(readFileSync(join(CONTENT, 'locales', locale, 'site.yaml'), 'utf8'))

/** The section label ("Compass" / «Путь») read straight out of the UI-string
 *  dictionary, so the card can't drift from the site's own wording. */
function sectionLabel(locale) {
  const src = readFileSync(join(ROOT, 'src/locales', `${locale}.ts`), 'utf8')
  const m = src.match(/"compass\.title":\s*"([^"]+)"/)
  if (!m) throw new Error(`og-cards: compass.title not found in src/locales/${locale}.ts`)
  return m[1]
}

function main() {
  const onlyArg = process.argv.slice(2).find((a) => a.startsWith('--only='))
  const only = onlyArg ? new Set(onlyArg.slice('--only='.length).split(',')) : null

  const colors = palette()
  // `name` is locale-identical, so it is authored in en/site.yaml only (see
  // getSite's fall-back-to-en merge).
  const siteName = siteYaml('en').name
  mkdirSync(OUT_DIR, { recursive: true })

  let written = 0
  for (const locale of LOCALES) {
    const label = sectionLabel(locale)
    for (const epic of siteYaml(locale).epics ?? []) {
      if (only && !only.has(epic.tag)) continue
      const file = join(OUT_DIR, `course-${epic.tag}-${locale}.svg`)
      writeFileSync(file, renderCard({ label, title: epic.title, siteName, colors }))
      console.log(`wrote ${file}`)
      written++
    }
  }
  if (!written) console.log('Nothing written (no matching courses).')
}

main()
