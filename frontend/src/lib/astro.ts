// Astronomically-grounded astrology, computed in-browser from real ephemeris
// positions (astronomy-engine, Swiss-ephemeris-grade). Geocentric, apparent,
// tropical, ecliptic-of-date — the frame serious/Daragan-style astrology uses.
//
// No API, no key, no network. Everything here is derived from planetary
// longitudes: Moon phases, sign ingresses, void-of-course Moon, retrograde
// stations, major aspects, and eclipses, for any month. All human-facing wording
// lives in ./astroText (per locale); this file is math + glyphs only.

import * as A from 'astronomy-engine'
import type { AstroEvent } from './types'
import type { Locale } from './i18n'
import { astroText, type AstroText } from './astroText'

const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000

export type BodyName =
  | 'Sun' | 'Moon' | 'Mercury' | 'Venus' | 'Mars'
  | 'Jupiter' | 'Saturn' | 'Uranus' | 'Neptune' | 'Pluto'

// Locale-neutral glyphs (used for cell/panel icons and aspect blurbs).
const BODY_GLYPH: Record<BodyName, string> = {
  Sun: '☉', Moon: '☽', Mercury: '☿', Venus: '♀', Mars: '♂',
  Jupiter: '♃', Saturn: '♄', Uranus: '♅', Neptune: '♆', Pluto: '♇',
}

// Planets that get ingress / retrograde / aspect treatment (Moon and Sun handled
// specially; Sun still participates in aspects and has its own ingress).
const PLANETS: BodyName[] = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']
const ASPECT_BODIES: BodyName[] = ['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']
// Classical seven (minus Moon itself) used to judge void-of-course.
const CLASSICAL: BodyName[] = ['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']

// Aspect index here MUST line up with aspectName/aspectTone order in astroText.
const ASPECTS = [
  { angle: 0, glyph: '☌' }, // conjunction
  { angle: 60, glyph: '⚹' }, // sextile
  { angle: 90, glyph: '□' }, // square
  { angle: 120, glyph: '△' }, // trine
  { angle: 180, glyph: '☍' }, // opposition
] as const

// Moon-phase search targets + icons (index lines up with phaseName in astroText).
const PHASES = [
  { target: 0, icon: '🌑' }, // New Moon
  { target: 90, icon: '🌓' }, // First Quarter
  { target: 180, icon: '🌕' }, // Full Moon
  { target: 270, icon: '🌗' }, // Last Quarter
] as const

const wrap360 = (x: number) => ((x % 360) + 360) % 360
const wrap180 = (x: number) => {
  const v = wrap360(x)
  return v > 180 ? v - 360 : v
}
const signIndex = (lon: number) => Math.floor(wrap360(lon) / 30)

/** Geocentric apparent ecliptic-of-date longitude in degrees (0..360). */
function lon(body: BodyName, date: Date): number {
  const t = A.MakeTime(date)
  const vec = A.GeoVector(A.Body[body], t, true)
  const ecl = A.RotateVector(A.Rotation_EQJ_ECT(t), vec)
  return wrap360(A.SphereFromVector(ecl).lon)
}

/** Longitudinal speed in deg/day (negative = retrograde). */
function speed(body: BodyName, date: Date): number {
  const dt = 0.5
  const a = lon(body, new Date(date.getTime() - dt * DAY_MS))
  const b = lon(body, new Date(date.getTime() + dt * DAY_MS))
  return wrap180(b - a) / (2 * dt)
}

/** Bisection refine of a sign-changing continuous function f(Date) → number. */
function refine(f: (d: Date) => number, a: number, b: number): Date {
  let fa = f(new Date(a))
  for (let i = 0; i < 42; i++) {
    const m = (a + b) / 2
    const fm = f(new Date(m))
    if (fm === 0) return new Date(m)
    if (Math.sign(fm) === Math.sign(fa)) {
      a = m
      fa = fm
    } else {
      b = m
    }
  }
  return new Date((a + b) / 2)
}

/**
 * Find times in [start,end] where f crosses zero. `guard` rejects false
 * crossings from wrap discontinuities (a real crossing changes f only slightly).
 */
function crossings(f: (d: Date) => number, start: number, end: number, stepH: number, guard = 90): Date[] {
  const out: Date[] = []
  const step = stepH * HOUR_MS
  let prevT = start
  let prev = f(new Date(prevT))
  for (let t = start + step; t <= end; t += step) {
    const cur = f(new Date(t))
    if (prev !== 0 && cur !== 0 && Math.sign(cur) !== Math.sign(prev) && Math.abs(cur - prev) < guard) {
      out.push(refine(f, prevT, t))
    }
    prevT = t
    prev = cur
  }
  return out
}

type Raw = { when: Date; title: string; body: string; icon: string; kind: string; blurb: string }

const inWindow = (d: Date, start: number, end: number) => d.getTime() >= start && d.getTime() < end

// ---- event generators (wording comes from the AstroText bundle `T`) ----

function moonPhases(start: number, end: number, out: Raw[], T: AstroText) {
  PHASES.forEach((p, phaseIdx) => {
    let from = A.MakeTime(new Date(start))
    for (let i = 0; i < 3; i++) {
      const hit = A.SearchMoonPhase(p.target, from, 40)
      if (!hit || hit.date.getTime() >= end) break
      if (hit.date.getTime() >= start) {
        const { title, blurb } = T.moonPhase(phaseIdx, signIndex(lon('Moon', hit.date)))
        out.push({ when: hit.date, title, body: T.label('Moon'), icon: p.icon, kind: 'phase', blurb })
      }
      from = A.MakeTime(new Date(hit.date.getTime() + DAY_MS))
    }
  })
}

function ingresses(body: BodyName, start: number, end: number, out: Raw[], T: AstroText) {
  const stepH = body === 'Moon' ? 3 : 12
  const step = stepH * HOUR_MS
  let prevT = start
  let prevIdx = signIndex(lon(body, new Date(prevT)))
  for (let t = start + step; t <= end; t += step) {
    const idx = signIndex(lon(body, new Date(t)))
    if (idx !== prevIdx) {
      // boundary between prevIdx and idx (forward or retrograde)
      const boundary = (idx === (prevIdx + 1) % 12 ? idx : prevIdx) * 30
      const when = refine((d) => wrap180(lon(body, d) - boundary), prevT, t)
      const { title, blurb } = T.ingress(body, idx)
      out.push({
        when,
        title,
        body: T.label(body),
        icon: body === 'Moon' ? '☽' : BODY_GLYPH[body],
        kind: body === 'Moon' ? 'moon-ingress' : 'ingress',
        blurb,
      })
    }
    prevT = t
    prevIdx = idx
  }
}

function retrogrades(body: BodyName, start: number, end: number, out: Raw[], T: AstroText) {
  const stations = crossings((d) => speed(body, d), start, end, 24, 100)
  for (const when of stations) {
    const after = speed(body, new Date(when.getTime() + DAY_MS))
    const direct = after > 0
    const { title, blurb } = T.retrograde(body, signIndex(lon(body, when)), direct)
    out.push({ when, title, body: T.label(body), icon: direct ? BODY_GLYPH[body] : '℞', kind: 'retrograde', blurb })
  }
}

function aspects(start: number, end: number, out: Raw[], T: AstroText) {
  for (let ai = 0; ai < ASPECTS.length; ai++) {
    const asp = ASPECTS[ai]
    const rs = asp.angle === 0 || asp.angle === 180 ? [asp.angle] : [asp.angle, 360 - asp.angle]
    for (let i = 0; i < ASPECT_BODIES.length; i++) {
      for (let j = i + 1; j < ASPECT_BODIES.length; j++) {
        const b1 = ASPECT_BODIES[i]
        const b2 = ASPECT_BODIES[j]
        const rel = (d: Date) => wrap360(lon(b1, d) - lon(b2, d))
        for (const r of rs) {
          for (const when of crossings((d) => wrap180(rel(d) - r), start, end, 12, 90)) {
            out.push({
              when,
              title: T.aspectTitle(b1, b2, ai),
              body: T.label(b1),
              icon: asp.glyph,
              kind: 'aspect',
              blurb: `${BODY_GLYPH[b1]} ${asp.glyph} ${BODY_GLYPH[b2]} — ${T.aspectTone(ai)}.`,
            })
          }
        }
      }
    }
  }
}

function voidOfCourse(start: number, end: number, out: Raw[], T: AstroText, locale: Locale) {
  // Moon sign-ingress boundaries across (and just around) the window.
  const scanStart = start - 3 * DAY_MS
  const ingressTimes: number[] = []
  const step = 3 * HOUR_MS
  let prevT = scanStart
  let prevIdx = signIndex(lon('Moon', new Date(prevT)))
  for (let t = scanStart + step; t <= end + DAY_MS; t += step) {
    const idx = signIndex(lon('Moon', new Date(t)))
    if (idx !== prevIdx) {
      const boundary = (idx === (prevIdx + 1) % 12 ? idx : prevIdx) * 30
      ingressTimes.push(refine((d) => wrap180(lon('Moon', d) - boundary), prevT, t).getTime())
      prevIdx = idx
    }
    prevT = t
  }
  // All Moon→classical-planet aspect times in the scan range.
  const aspectTimes: number[] = []
  const rTargets = ASPECTS.flatMap((a) => (a.angle === 0 || a.angle === 180 ? [a.angle] : [a.angle, 360 - a.angle]))
  for (const p of CLASSICAL) {
    const rel = (d: Date) => wrap360(lon('Moon', d) - lon(p, d))
    for (const r of rTargets) {
      for (const hit of crossings((d) => wrap180(rel(d) - r), scanStart, end + DAY_MS, 3, 90)) {
        aspectTimes.push(hit.getTime())
      }
    }
  }
  aspectTimes.sort((a, b) => a - b)
  // For each ingress that lands in the window, VoC = last aspect before it → that ingress.
  for (const ing of ingressTimes) {
    if (!inWindow(new Date(ing), start, end)) continue
    const lastAspect = aspectTimes.filter((t) => t < ing).pop()
    const from = lastAspect ?? ing - DAY_MS
    const nextIdx = signIndex(lon('Moon', new Date(ing + HOUR_MS)))
    const { title, blurb } = T.voc(nextIdx, fmtTime(new Date(ing), locale))
    out.push({ when: new Date(from), title, body: T.label('Moon'), icon: '∅', kind: 'voc', blurb })
  }
}

function eclipses(start: number, end: number, out: Raw[], T: AstroText) {
  const from = A.MakeTime(new Date(start - DAY_MS))
  const lunar = A.SearchLunarEclipse(from)
  if (lunar && inWindow(lunar.peak.date, start, end)) {
    const { title, blurb } = T.eclipse('lunar', signIndex(lon('Moon', lunar.peak.date)))
    out.push({ when: lunar.peak.date, title, body: T.label('Moon'), icon: '🌕', kind: 'eclipse', blurb })
  }
  const solar = A.SearchGlobalSolarEclipse(from)
  if (solar && inWindow(solar.peak.date, start, end)) {
    const { title, blurb } = T.eclipse('solar', signIndex(lon('Sun', solar.peak.date)))
    out.push({ when: solar.peak.date, title, body: T.label('Sun'), icon: '🌑', kind: 'eclipse', blurb })
  }
}

// ---- date formatting (viewer's local time, locale-formatted) ----

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const fmtTime = (d: Date, locale: Locale) => d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })

const cache = new Map<string, AstroEvent[]>()

/** All computed events whose local calendar day falls in the given month. */
export function eventsForMonth(year: number, monthIndex: number, locale: Locale): AstroEvent[] {
  const key = `${locale}-${year}-${monthIndex}`
  const cached = cache.get(key)
  if (cached) return cached

  const T = astroText(locale)
  const start = new Date(year, monthIndex, 1).getTime()
  const end = new Date(year, monthIndex + 1, 1).getTime()
  const raw: Raw[] = []

  moonPhases(start, end, raw, T)
  ingresses('Sun', start, end, raw, T)
  ingresses('Moon', start, end, raw, T)
  for (const p of PLANETS) {
    ingresses(p, start, end, raw, T)
    retrogrades(p, start, end, raw, T)
  }
  aspects(start, end, raw, T)
  voidOfCourse(start, end, raw, T, locale)
  eclipses(start, end, raw, T)

  const events: AstroEvent[] = raw
    .sort((a, b) => a.when.getTime() - b.when.getTime())
    .map((r) => ({
      date: ymd(r.when),
      time: fmtTime(r.when, locale),
      title: r.title,
      body: r.body,
      icon: r.icon,
      kind: r.kind,
      blurb: r.blurb,
    }))

  cache.set(key, events)
  return events
}
