#!/usr/bin/env node
// Measures Compass chapter content-density: how much of a chapter is
// scaffold (trail block, hook, promise/now-you-can/check-yourself/next) vs
// substance (core, worked example, practice), and how many "hard facts" the
// core + worked-example sections actually carry.
//
// WHY THIS EXISTS: a reader flagged the RU aromatherapy course as "90%
// water". Manual counting showed its ch.1 core had 0 hard facts in ~1,270
// words, ch.2 0 in ~950, while wooden-house (the pattern-v2 reference course)
// runs a clearly non-zero density in the same sections. This script makes
// that measurement repeatable instead of a one-off manual read.
//
// ****************************************************************
// * THE FACT COUNT IS A PROXY — A SMOKE ALARM, NOT A GRADE.       *
// * It regex-matches numbers-with-units, ratios, and Latin         *
// * binomials. A chapter can teach real, dense content without     *
// * tripping the regex (a definition, a named method, a worked     *
// * decision with no digit in it) — and a chapter could in theory  *
// * stuff in meaningless numbers to game the count. Use this to    *
// * catch chapters that are OBVIOUSLY all framing and no content   *
// * (the aromatherapy case: literally zero matches). Never read a  *
// * pass/fail here as a quality verdict on its own — skim the      *
// * flagged chapter before deciding anything.                      *
// ****************************************************************
//
// House style follows scripts/generate-mandala.mjs / generate-og-cards.mjs:
// plain Node script, zero dependencies, config at the top.
//
// Usage:
//   node scripts/check-density.mjs                 # scan every course, both locales
//   DIR=wooden-house node scripts/check-density.mjs # one course dir (either/both locales)
//   FILE=content/locales/ru/compass/aromatherapy/01-what-living-scent-is.md node scripts/check-density.mjs
//   FLOOR=15 node scripts/check-density.mjs         # override the facts-per-1000-core-words floor
//   STRICT=1 node scripts/check-density.mjs         # exit non-zero if anything is under the floor

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CONTENT = join(ROOT, '..', 'content', 'locales')
const LOCALES = ['ru', 'en']
const DEFAULT_FLOOR = 12 // hard facts per 1,000 core words

// ── section titles (pattern v2) ─────────────────────────────────────────────
// Sections are `## ` headings. Heading 1 is free-titled in RU v2 chapters (a
// short "hook" line, e.g. "Лаванда, которой не было") — it is classified as
// scaffold purely by POSITION (always the first `##`), never by title match.
// Everything after it is classified by matching these known titles; a
// heading that matches neither list (a one-off custom heading some chapters
// use instead of "Дальше"/"Next", or a stray mid-chapter heading) counts
// toward total words but not toward scaffold or core.
const SCAFFOLD_TITLES = {
  ru: ['Обещание главы', 'Теперь вы умеете', 'Проверьте себя', 'Дальше'],
  en: ['The promise', 'Now you can', 'Check yourself', 'Next'],
}
// Substance = not scaffold. Only core + worked example feed the fact count;
// Practice is substance (not scaffold%) but isn't "core" for facts — it's
// action items, not the section carrying the chapter's information.
const SUBSTANCE_TITLES = {
  ru: ['Суть', 'Разбор на живом примере', 'Практика'],
  en: ['The core', 'Worked example', 'Practice'],
}
const CORE_TITLES = {
  ru: ['Суть', 'Разбор на живом примере'],
  en: ['The core', 'Worked example'],
}

// ── hard-fact matching ───────────────────────────────────────────────────────
// A hard fact: a number with a unit/percent/degree, a ratio (2:1), or a Latin
// binomial. Deliberately narrow — see the header comment on why this is a
// proxy, not a completeness guarantee.
const NUMBER = '[-−]?\\d+(?:[.,]\\d+)?' // optional minus/− sign, decimal comma or point
const SEP = '[\\s-]{0,2}' // space and/or hyphen between number and unit ("150-year")
// One short intervening word is allowed ("117 frost days") — English commonly
// puts an adjective between the count and the unit noun.
const MID = '(?:[\\p{L}]{1,15}[\\s-])?'
const LETTER_UNITS = [
  // RU (longest-first doesn't matter for correctness here — none of these
  // literal tokens is a prefix of another after the digit)
  'мл', 'мм', 'см', 'кг', 'мин', 'капл\\w*', 'капель', 'дн\\w*', 'лет', 'м', 'г', 'ч',
  // EN
  'ml', 'mm', 'cm', 'kg', 'min', 'drops?', 'days?', 'years?', 'm', 'g', 'h',
]
const SYMBOL_UNITS = ['%', '°'] // % and ° — no letter-boundary guard, so "8.7 °C" still matches
const LETTER_ALT = LETTER_UNITS.join('|')
const SYMBOL_ALT = SYMBOL_UNITS.join('|')
const FACT_LETTER_RE = new RegExp(`${NUMBER}${SEP}${MID}(?:${LETTER_ALT})(?![\\p{L}])`, 'gu')
const FACT_SYMBOL_RE = new RegExp(`${NUMBER}${SEP}(?:${SYMBOL_ALT})`, 'gu')
// A dilution/mix ratio ("2:1", "1:10"). Capped at 1-20 on both sides so it
// doesn't swallow HH:MM journal timestamps ("21:40", "15:30") — every
// timestamp in the current corpus has at least one side outside that range.
const RATIO_RE = /\b([1-9]|1[0-9]|20):([1-9]|1[0-9]|20)\b/g
// A Latin binomial, restricted to markdown italics (*Genus species*) so it
// doesn't fire on ordinary capitalized-word-then-lowercase-word English
// sentence starts ("This chapter…", "Two houses…") — verified against the
// wooden-house corpus, which has plenty of those and zero real binomials.
const LATIN_RE = /(?<!\*)\*([A-ZÀ-Þ][a-zà-ÿ]+)\s+([a-zà-ÿ]+)\*(?!\*)/g
// A number range ("15–25 m", "1,450–1,500 mm") counts as two facts — a
// reader really does get two data points out of it — but must not also be
// double-counted by FACT_LETTER_RE/FACT_SYMBOL_RE matching its second half,
// so its matched span gets blanked out before those run (see countFacts).
const RANGE_RE = new RegExp(
  `${NUMBER}\\s?[-–—]\\s?${NUMBER}${SEP}${MID}(?:${LETTER_ALT}|${SYMBOL_ALT})(?![\\p{L}])`,
  'gu',
)

function countFacts(text) {
  const ranges = [...text.matchAll(RANGE_RE)]
  let scrubbed = text
  for (const m of ranges) {
    scrubbed = scrubbed.slice(0, m.index) + ' '.repeat(m[0].length) + scrubbed.slice(m.index + m[0].length)
  }
  const letters = [...scrubbed.matchAll(FACT_LETTER_RE)].map((m) => m[0])
  const symbols = [...scrubbed.matchAll(FACT_SYMBOL_RE)].map((m) => m[0])
  const ratios = [...scrubbed.matchAll(RATIO_RE)].map((m) => m[0])
  const latin = [...scrubbed.matchAll(LATIN_RE)].map((m) => m[0])
  const rangeMatches = ranges.map((m) => m[0])
  return {
    count: ranges.length * 2 + letters.length + symbols.length + ratios.length + latin.length,
    detail: { ranges: rangeMatches, letters, symbols, ratios, latin },
  }
}

// ── epistemology-machinery matching (visibility, not a fact type) ──────────
// The trust-ladder / "verify it yourself" apparatus. Not a hard fact — this
// exists so a chapter that leans heavily on the ladder itself (rather than
// giving the reader something to check the ladder against) is visible.
const EPISTEMOLOGY_RE = {
  ru: /лестниц\S*\s+довер\S*|почувствовал\s+сам\S*|проверьте\s+сами|рунг\S*|ступен\S*|маркетинговый\s+миф\S*|давняя\s+традици\S*|есть\s+исследовани\S*|кому\s+выгодно|не\s+козыр\S*/giu,
  en: /trust\s+ladder|felt\s+it\s+myself|check\s+for\s+yourself|rung\S*|marketing\s+myth\S*|who\s+benefits|not\s+a\s+trump\S*/giu,
}

// ── word counting ───────────────────────────────────────────────────────────
function words(text) {
  return (text.replace(/^#{1,6}\s*/gm, '').match(/\S+/g) || []).length
}

// ── locale detection ─────────────────────────────────────────────────────────
// Content-first: chapter drafts legitimately live outside content/locales/
// (e.g. a work-in-progress in context/<topic>/) before they move into their
// final home, so path alone is not reliable. Count Cyrillic vs Latin letters
// in the body; the path (content/locales/<lc>/…) only breaks a genuine tie.
function detectLocale(path, body) {
  const cyrillic = (body.match(/[Ѐ-ӿ]/g) || []).length
  const latin = (body.match(/[A-Za-z]/g) || []).length
  if (cyrillic > latin) return 'ru'
  if (latin > cyrillic) return 'en'
  return path.includes('/locales/ru/') ? 'ru' : 'en'
}

// ── per-chapter analysis ─────────────────────────────────────────────────────
function analyzeChapter(path) {
  const raw = readFileSync(path, 'utf8')
  const body = raw.replace(/^---[\s\S]*?---\n?/, '')
  const locale = detectLocale(path, body)
  const heads = [...body.matchAll(/^##\s+(.+?)\s*$/gm)]
  const trail = heads.length ? body.slice(0, heads[0].index) : body

  let scaffoldWords = words(trail)
  let coreText = ''
  let coreSectionsFound = 0
  for (let i = 0; i < heads.length; i++) {
    const title = heads[i][1].trim()
    const start = heads[i].index
    const end = i + 1 < heads.length ? heads[i + 1].index : body.length
    const sectionText = body.slice(start, end)
    if (i === 0) {
      // heading 1 — the hook — is scaffold purely by position
      scaffoldWords += words(sectionText)
      continue
    }
    if (SCAFFOLD_TITLES[locale].includes(title)) {
      scaffoldWords += words(sectionText)
    } else if (CORE_TITLES[locale].includes(title)) {
      coreText += sectionText + '\n'
      coreSectionsFound++
    }
    // else: substance-but-not-core (Practice) or an unrecognized heading —
    // counted in totalWords, not in scaffold or core.
  }

  const totalWords = words(body)
  const coreWords = words(coreText)
  const facts = countFacts(coreText)
  const epistemology = [...body.matchAll(EPISTEMOLOGY_RE[locale])].length
  // A chapter where NEITHER known core heading ("Суть"/"The core" or
  // "Разбор на живом примере"/"Worked example") was found is not "0 facts,
  // clean pass" — the parser couldn't locate the core at all (wrong locale
  // guess, a non-standard heading, a draft still missing sections). That is
  // the one case this tool must never silently pass.
  const parseFailure = heads.length === 0 || coreSectionsFound === 0

  return {
    path,
    locale,
    totalWords,
    scaffoldPct: totalWords ? (scaffoldWords / totalWords) * 100 : 0,
    coreWords,
    facts: facts.count,
    factDetail: facts.detail,
    per1k: coreWords ? (facts.count / coreWords) * 1000 : 0,
    epistemology,
    parseFailure,
  }
}

// ── file discovery (zero deps — no glob package) ────────────────────────────
function listMarkdown(dir) {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => join(dir, f))
    .sort()
}

function courseDirs(locale) {
  const compassDir = join(CONTENT, locale, 'compass')
  if (!statSync(compassDir, { throwIfNoEntry: false })?.isDirectory()) return []
  return readdirSync(compassDir)
    .filter((f) => statSync(join(compassDir, f)).isDirectory())
    .sort()
    .map((tag) => ({ tag, dir: join(compassDir, tag) }))
}

function resolveTargets() {
  const fileArg = process.env.FILE
  const dirArg = process.env.DIR
  const targets = [] // { path, course } — locale is detected from content, not path

  if (fileArg) {
    for (const f of fileArg.split(',').map((s) => s.trim()).filter(Boolean)) {
      const path = f.startsWith('/') ? f : join(process.cwd(), f)
      const resolved = statSync(path, { throwIfNoEntry: false })?.isFile() ? path : join(ROOT, '..', f)
      if (!statSync(resolved, { throwIfNoEntry: false })?.isFile()) {
        console.error(`density: FILE not found: ${f}`)
        continue
      }
      const course = dirname(resolved).split('/').pop()
      targets.push({ path: resolved, course })
    }
    return targets
  }

  if (dirArg) {
    for (const tag of dirArg.split(',').map((s) => s.trim()).filter(Boolean)) {
      let found = false
      // 1) a literal path (absolute or relative to repo root) — may live
      // anywhere, e.g. a draft under context/<topic>/ not yet moved into
      // content/locales/
      const literal = tag.startsWith('/') ? tag : join(ROOT, '..', tag)
      if (statSync(literal, { throwIfNoEntry: false })?.isDirectory()) {
        for (const f of listMarkdown(literal)) targets.push({ path: f, course: tag.split('/').pop() })
        found = true
      }
      // 2) a bare course tag — check it under both locale trees
      if (!found) {
        for (const locale of LOCALES) {
          const dir = join(CONTENT, locale, 'compass', tag)
          const files = listMarkdown(dir)
          if (files.length) {
            found = true
            for (const f of files) targets.push({ path: f, course: tag })
          }
        }
      }
      if (!found) console.error(`density: DIR not found: ${tag}`)
    }
    return targets
  }

  // default: every course, both locale trees
  for (const locale of LOCALES) {
    for (const { tag, dir } of courseDirs(locale)) {
      for (const f of listMarkdown(dir)) targets.push({ path: f, course: tag })
    }
  }
  return targets
}

// ── report ───────────────────────────────────────────────────────────────────
function fmtPct(n) {
  return `${n.toFixed(0)}%`
}
function fmt1(n) {
  return n.toFixed(1)
}

function main() {
  const floor = Number(process.env.FLOOR) || DEFAULT_FLOOR
  const strict = process.env.STRICT === '1'
  const targets = resolveTargets()

  if (!targets.length) {
    console.error('density: no chapters matched — check DIR/FILE.')
    process.exit(strict ? 1 : 0)
  }

  const rows = targets.map(({ path, course }) => ({
    course,
    ...analyzeChapter(path),
  }))

  console.log(
    `${'file'.padEnd(58)} ${'locale'.padEnd(6)} ${'words'.padStart(6)} ${'scaffold'.padStart(8)} ${'core'.padStart(6)} ${'facts'.padStart(5)} ${'facts/1k'.padStart(8)} ${'episte.'.padStart(7)}  flag`,
  )
  console.log('-'.repeat(120))

  let flagged = 0
  let parseFailures = 0
  const byCourse = new Map()
  for (const r of rows) {
    // A parse failure (no recognizable core section — wrong locale guess, a
    // non-standard heading set, a draft still missing sections) is ALWAYS
    // flagged, regardless of floor — 0.0 facts/1k must never read as a pass.
    const under = r.parseFailure || r.per1k < floor
    if (under) flagged++
    if (r.parseFailure) parseFailures++
    const key = `${r.locale}/${r.course}`
    if (!byCourse.has(key)) byCourse.set(key, [])
    byCourse.get(key).push(r)

    const flag = r.parseFailure ? '🛑 NO CORE SECTION FOUND — check locale/heading match' : under ? '⚠ under floor' : ''
    const rel = relative(ROOT, r.path)
    const per1kCell = r.parseFailure ? 'N/A' : fmt1(r.per1k)
    console.log(
      `${rel.padEnd(58)} ${r.locale.padEnd(6)} ${String(r.totalWords).padStart(6)} ${fmtPct(r.scaffoldPct).padStart(8)} ${String(r.coreWords).padStart(6)} ${String(r.facts).padStart(5)} ${per1kCell.padStart(8)} ${String(r.epistemology).padStart(7)}  ${flag}`,
    )
  }

  console.log('-'.repeat(120))
  console.log(`\nPer-course summary (facts/1,000 core words, weighted by core words; floor = ${floor}):\n`)
  for (const [key, chapters] of [...byCourse.entries()].sort()) {
    const totalCore = chapters.reduce((s, c) => s + c.coreWords, 0)
    const totalFacts = chapters.reduce((s, c) => s + c.facts, 0)
    const avg = totalCore ? (totalFacts / totalCore) * 1000 : 0
    const underCount = chapters.filter((c) => c.parseFailure || c.per1k < floor).length
    const failCount = chapters.filter((c) => c.parseFailure).length
    const note = failCount
      ? `🛑 ${failCount} with NO CORE FOUND${underCount > failCount ? ` + ${underCount - failCount} under floor` : ''}`
      : underCount
        ? `⚠ ${underCount} under floor`
        : 'all at/above floor'
    console.log(`  ${key.padEnd(24)} ${chapters.length} chapters  ${fmt1(avg).padStart(6)} facts/1k  ${note}`)
  }

  if (parseFailures) {
    console.log(`\n${parseFailures} chapter(s) had NO RECOGNIZABLE CORE SECTION — this tool could not measure them at all.`)
    console.log('Check the locale guess and heading titles against SCAFFOLD_TITLES/CORE_TITLES before trusting any other number for that file.')
  }
  if (flagged) {
    console.log(`\n${flagged} chapter(s) below the ${floor}/1,000 floor (including the above, if any).`)
    console.log('Reminder: this is a proxy — read the flagged chapter before concluding it is thin.')
  } else {
    console.log('\nNo chapters below the floor.')
  }

  if (strict && flagged) process.exit(1)
}

main()
