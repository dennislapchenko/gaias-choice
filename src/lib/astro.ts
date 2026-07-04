// Astronomically-grounded astrology, computed in-browser from real ephemeris
// positions (astronomy-engine, Swiss-ephemeris-grade). Geocentric, apparent,
// tropical, ecliptic-of-date — the frame serious/Daragan-style astrology uses.
//
// No API, no key, no network. Everything here is derived from planetary
// longitudes: Moon phases, sign ingresses, void-of-course Moon, retrograde
// stations, major aspects, and eclipses, for any month.

import * as A from 'astronomy-engine'
import type { AstroEvent } from './types'

const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000

type BodyName =
  | 'Sun' | 'Moon' | 'Mercury' | 'Venus' | 'Mars'
  | 'Jupiter' | 'Saturn' | 'Uranus' | 'Neptune' | 'Pluto'

const BODY: Record<BodyName, { glyph: string; label: string }> = {
  Sun: { glyph: '☉', label: 'Sun' },
  Moon: { glyph: '☽', label: 'Moon' },
  Mercury: { glyph: '☿', label: 'Mercury' },
  Venus: { glyph: '♀', label: 'Venus' },
  Mars: { glyph: '♂', label: 'Mars' },
  Jupiter: { glyph: '♃', label: 'Jupiter' },
  Saturn: { glyph: '♄', label: 'Saturn' },
  Uranus: { glyph: '♅', label: 'Uranus' },
  Neptune: { glyph: '♆', label: 'Neptune' },
  Pluto: { glyph: '♇', label: 'Pluto' },
}

// Planets that get ingress / retrograde / aspect treatment (Moon and Sun handled
// specially; Sun still participates in aspects and has its own ingress).
const PLANETS: BodyName[] = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']
const ASPECT_BODIES: BodyName[] = ['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']
// Classical seven (minus Moon itself) used to judge void-of-course.
const CLASSICAL: BodyName[] = ['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']

const SIGNS = [
  { name: 'Aries', glyph: '♈', element: 'fire' },
  { name: 'Taurus', glyph: '♉', element: 'earth' },
  { name: 'Gemini', glyph: '♊', element: 'air' },
  { name: 'Cancer', glyph: '♋', element: 'water' },
  { name: 'Leo', glyph: '♌', element: 'fire' },
  { name: 'Virgo', glyph: '♍', element: 'earth' },
  { name: 'Libra', glyph: '♎', element: 'air' },
  { name: 'Scorpio', glyph: '♏', element: 'water' },
  { name: 'Sagittarius', glyph: '♐', element: 'fire' },
  { name: 'Capricorn', glyph: '♑', element: 'earth' },
  { name: 'Aquarius', glyph: '♒', element: 'air' },
  { name: 'Pisces', glyph: '♓', element: 'water' },
] as const

const ELEMENT_TONE: Record<string, string> = {
  fire: 'initiative and spirit',
  earth: 'body, patience and resources',
  air: 'mind, contact and exchange',
  water: 'feeling, memory and depth',
}

const ASPECTS = [
  { angle: 0, name: 'conjunction', glyph: '☌', tone: 'fusion — energies merge and act as one' },
  { angle: 60, name: 'sextile', glyph: '⚹', tone: 'opportunity — an open door if you act on it' },
  { angle: 90, name: 'square', glyph: '□', tone: 'friction — tension that demands adjustment' },
  { angle: 120, name: 'trine', glyph: '△', tone: 'flow — ease and natural talent' },
  { angle: 180, name: 'opposition', glyph: '☍', tone: 'polarity — awareness through the other' },
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

// ---- event generators ----

function moonPhases(start: number, end: number, out: Raw[]) {
  const phases = [
    { target: 0, name: 'New Moon', icon: '🌑', tone: 'seed an intention; a fresh cycle begins' },
    { target: 90, name: 'First Quarter', icon: '🌓', tone: 'act through resistance; commit to the build' },
    { target: 180, name: 'Full Moon', icon: '🌕', tone: 'culmination and clarity; what was hidden shows' },
    { target: 270, name: 'Last Quarter', icon: '🌗', tone: 'release and reorient; let go of what is done' },
  ]
  for (const p of phases) {
    let from = A.MakeTime(new Date(start))
    for (let i = 0; i < 3; i++) {
      const hit = A.SearchMoonPhase(p.target, from, 40)
      if (!hit || hit.date.getTime() >= end) break
      if (hit.date.getTime() >= start) {
        const s = SIGNS[signIndex(lon('Moon', hit.date))]
        out.push({
          when: hit.date,
          title: `${p.name} in ${s.name}`,
          body: 'Moon',
          icon: p.icon,
          kind: 'phase',
          blurb: `${p.tone}. The Moon is in ${s.name} — ${ELEMENT_TONE[s.element]}.`,
        })
      }
      from = A.MakeTime(new Date(hit.date.getTime() + DAY_MS))
    }
  }
}

function ingresses(body: BodyName, start: number, end: number, out: Raw[]) {
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
      const target = SIGNS[idx]
      out.push({
        when,
        title: `${BODY[body].label} enters ${target.name}`,
        body,
        icon: body === 'Moon' ? '☽' : BODY[body].glyph,
        kind: body === 'Moon' ? 'moon-ingress' : 'ingress',
        blurb:
          body === 'Moon'
            ? `The emotional tone turns to ${target.name} — ${ELEMENT_TONE[target.element]}.`
            : `${BODY[body].label} shifts into ${target.name} — its themes now colour ${ELEMENT_TONE[target.element]}.`,
      })
    }
    prevT = t
    prevIdx = idx
  }
}

function retrogrades(body: BodyName, start: number, end: number, out: Raw[]) {
  const stations = crossings((d) => speed(body, d), start, end, 24, 100)
  for (const when of stations) {
    const after = speed(body, new Date(when.getTime() + DAY_MS))
    const direct = after > 0
    const s = SIGNS[signIndex(lon(body, when))]
    out.push({
      when,
      title: `${BODY[body].label} stations ${direct ? 'direct' : 'retrograde'}`,
      body,
      icon: direct ? BODY[body].glyph : '℞',
      kind: 'retrograde',
      blurb: direct
        ? `${BODY[body].label} turns direct in ${s.name} — its matters resume forward motion.`
        : `${BODY[body].label} turns retrograde in ${s.name} — review, revisit, reconsider; outward progress pauses.`,
    })
  }
}

type AspectDef = (typeof ASPECTS)[number]

function aspects(start: number, end: number, out: Raw[]) {
  const targets = ASPECTS.flatMap((asp): { r: number; asp: AspectDef }[] =>
    asp.angle === 0 || asp.angle === 180 ? [{ r: asp.angle, asp }] : [{ r: asp.angle, asp }, { r: 360 - asp.angle, asp }],
  )
  for (let i = 0; i < ASPECT_BODIES.length; i++) {
    for (let j = i + 1; j < ASPECT_BODIES.length; j++) {
      const b1 = ASPECT_BODIES[i]
      const b2 = ASPECT_BODIES[j]
      const rel = (d: Date) => wrap360(lon(b1, d) - lon(b2, d))
      for (const { r, asp } of targets) {
        const hits = crossings((d) => wrap180(rel(d) - r), start, end, 12, 90)
        for (const when of hits) {
          out.push({
            when,
            title: `${BODY[b1].label} ${asp.name} ${BODY[b2].label}`,
            body: b1,
            icon: asp.glyph,
            kind: 'aspect',
            blurb: `${BODY[b1].glyph} ${asp.glyph} ${BODY[b2].glyph} — ${asp.tone}.`,
          })
        }
      }
    }
  }
}

function voidOfCourse(start: number, end: number, out: Raw[]) {
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
    const nextSign = SIGNS[signIndex(lon('Moon', new Date(ing + HOUR_MS)))]
    const until = new Date(ing)
    out.push({
      when: new Date(from),
      title: 'Moon void of course',
      body: 'Moon',
      icon: '∅',
      kind: 'voc',
      blurb: `The Moon makes no further aspects until it enters ${nextSign.name} at ${fmtTime(until)}. Begin nothing new — finish, rest, reflect.`,
    })
  }
}

function eclipses(start: number, end: number, out: Raw[]) {
  const from = A.MakeTime(new Date(start - DAY_MS))
  const lunar = A.SearchLunarEclipse(from)
  if (lunar && inWindow(lunar.peak.date, start, end)) {
    const s = SIGNS[signIndex(lon('Moon', lunar.peak.date))]
    out.push({
      when: lunar.peak.date,
      title: `Lunar eclipse in ${s.name}`,
      body: 'Moon',
      icon: '🌕',
      kind: 'eclipse',
      blurb: `A charged Full Moon in ${s.name} — a culmination you don't fully control; something comes to light or completion.`,
    })
  }
  const solar = A.SearchGlobalSolarEclipse(from)
  if (solar && inWindow(solar.peak.date, start, end)) {
    const s = SIGNS[signIndex(lon('Sun', solar.peak.date))]
    out.push({
      when: solar.peak.date,
      title: `Solar eclipse in ${s.name}`,
      body: 'Sun',
      icon: '🌑',
      kind: 'eclipse',
      blurb: `A charged New Moon in ${s.name} — a reset you don't fully steer; a doorway opens.`,
    })
  }
}

// ---- date formatting (viewer's local time) ----

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const fmtTime = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

const cache = new Map<string, AstroEvent[]>()

/** All computed events whose local calendar day falls in the given month. */
export function eventsForMonth(year: number, monthIndex: number): AstroEvent[] {
  const key = `${year}-${monthIndex}`
  const cached = cache.get(key)
  if (cached) return cached

  const start = new Date(year, monthIndex, 1).getTime()
  const end = new Date(year, monthIndex + 1, 1).getTime()
  const raw: Raw[] = []

  moonPhases(start, end, raw)
  ingresses('Sun', start, end, raw)
  ingresses('Moon', start, end, raw)
  for (const p of PLANETS) {
    ingresses(p, start, end, raw)
    retrogrades(p, start, end, raw)
  }
  aspects(start, end, raw)
  voidOfCourse(start, end, raw)
  eclipses(start, end, raw)

  const events: AstroEvent[] = raw
    .sort((a, b) => a.when.getTime() - b.when.getTime())
    .map((r) => ({
      date: ymd(r.when),
      time: fmtTime(r.when),
      title: r.title,
      body: r.body,
      icon: r.icon,
      kind: r.kind,
      blurb: r.blurb,
    }))

  cache.set(key, events)
  return events
}
