// All human-facing wording for the almanac, per locale. `astro.ts` owns the
// math and the (locale-neutral) glyphs; this file owns every translated word so
// the ephemeris stays language-free. Russian follows serious, Daragan-style
// astrological usage — including the grammatical cases signs take in different
// phrasings ("в Раке" for *in* Cancer vs "в Рака" for *enters* Cancer).

import type { Locale } from './i18n'
import type { BodyName } from './astro'

type Phrase = { title: string; blurb: string }
type Elem = 'fire' | 'earth' | 'air' | 'water'

// Element by sign index (Aries→fire, Taurus→earth, … cycling every 4).
const ELEM_ORDER: Elem[] = ['fire', 'earth', 'air', 'water']

interface Vocab {
  body: Record<BodyName, string>
  poss: Record<BodyName, string> // possessive ("its" / его|её) for blurb agreement
  signNom: readonly string[] // 12, nominative (standalone)
  signIn: readonly string[] // 12, locative incl. preposition ("in Cancer" / "в Раке")
  signTo: readonly string[] // 12, after a motion verb ("Cancer" / "в Рака")
  element: Record<Elem, string>
  phaseName: readonly string[] // 4: New, First Quarter, Full, Last Quarter
  phaseTone: readonly string[] // 4
  aspectName: readonly string[] // 5: conjunction, sextile, square, trine, opposition
  aspectTone: readonly string[] // 5
  phaseTitle: (phase: string, signIn: string) => string
  phaseBlurb: (tone: string, signIn: string, elem: string) => string
  moonIngress: (signTo: string, elem: string) => Phrase
  planetIngress: (label: string, poss: string, signTo: string, elem: string) => Phrase
  retrograde: (label: string, poss: string, signIn: string, direct: boolean) => Phrase
  aspectTitle: (l1: string, name: string, l2: string) => string
  voc: (signTo: string, time: string) => Phrase
  eclipse: (kind: 'lunar' | 'solar', signIn: string) => Phrase
}

const EN_SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
]

const EN: Vocab = {
  body: {
    Sun: 'Sun', Moon: 'Moon', Mercury: 'Mercury', Venus: 'Venus', Mars: 'Mars',
    Jupiter: 'Jupiter', Saturn: 'Saturn', Uranus: 'Uranus', Neptune: 'Neptune', Pluto: 'Pluto',
  },
  poss: {
    Sun: 'its', Moon: 'its', Mercury: 'its', Venus: 'its', Mars: 'its',
    Jupiter: 'its', Saturn: 'its', Uranus: 'its', Neptune: 'its', Pluto: 'its',
  },
  signNom: EN_SIGNS,
  signIn: EN_SIGNS.map((s) => `in ${s}`),
  signTo: EN_SIGNS,
  element: {
    fire: 'initiative and spirit',
    earth: 'body, patience and resources',
    air: 'mind, contact and exchange',
    water: 'feeling, memory and depth',
  },
  phaseName: ['New Moon', 'First Quarter', 'Full Moon', 'Last Quarter'],
  phaseTone: [
    'seed an intention; a fresh cycle begins',
    'act through resistance; commit to the build',
    'culmination and clarity; what was hidden shows',
    'release and reorient; let go of what is done',
  ],
  aspectName: ['conjunction', 'sextile', 'square', 'trine', 'opposition'],
  aspectTone: [
    'fusion — energies merge and act as one',
    'opportunity — an open door if you act on it',
    'friction — tension that demands adjustment',
    'flow — ease and natural talent',
    'polarity — awareness through the other',
  ],
  phaseTitle: (phase, signIn) => `${phase} ${signIn}`,
  phaseBlurb: (tone, signIn, elem) => `${tone}. The Moon is ${signIn} — ${elem}.`,
  moonIngress: (signTo, elem) => ({
    title: `Moon enters ${signTo}`,
    blurb: `The emotional tone turns to ${signTo} — ${elem}.`,
  }),
  planetIngress: (label, poss, signTo, elem) => ({
    title: `${label} enters ${signTo}`,
    blurb: `${label} shifts into ${signTo} — ${poss} themes now colour ${elem}.`,
  }),
  retrograde: (label, poss, signIn, direct) =>
    direct
      ? {
          title: `${label} stations direct`,
          blurb: `${label} turns direct ${signIn} — ${poss} matters resume forward motion.`,
        }
      : {
          title: `${label} stations retrograde`,
          blurb: `${label} turns retrograde ${signIn} — review, revisit, reconsider; outward progress pauses.`,
        },
  aspectTitle: (l1, name, l2) => `${l1} ${name} ${l2}`,
  voc: (signTo, time) => ({
    title: 'Moon void of course',
    blurb: `The Moon makes no further aspects until it enters ${signTo} at ${time}. Begin nothing new — finish, rest, reflect.`,
  }),
  eclipse: (kind, signIn) =>
    kind === 'lunar'
      ? {
          title: `Lunar eclipse ${signIn}`,
          blurb: `A charged Full Moon ${signIn} — a culmination you don't fully control; something comes to light or completion.`,
        }
      : {
          title: `Solar eclipse ${signIn}`,
          blurb: `A charged New Moon ${signIn} — a reset you don't fully steer; a doorway opens.`,
        },
}

const RU: Vocab = {
  body: {
    Sun: 'Солнце', Moon: 'Луна', Mercury: 'Меркурий', Venus: 'Венера', Mars: 'Марс',
    Jupiter: 'Юпитер', Saturn: 'Сатурн', Uranus: 'Уран', Neptune: 'Нептун', Pluto: 'Плутон',
  },
  poss: {
    Sun: 'его', Moon: 'её', Mercury: 'его', Venus: 'её', Mars: 'его',
    Jupiter: 'его', Saturn: 'его', Uranus: 'его', Neptune: 'его', Pluto: 'его',
  },
  signNom: ['Овен', 'Телец', 'Близнецы', 'Рак', 'Лев', 'Дева', 'Весы', 'Скорпион', 'Стрелец', 'Козерог', 'Водолей', 'Рыбы'],
  signIn: ['в Овне', 'в Тельце', 'в Близнецах', 'в Раке', 'во Льве', 'в Деве', 'в Весах', 'в Скорпионе', 'в Стрельце', 'в Козероге', 'в Водолее', 'в Рыбах'],
  signTo: ['в Овна', 'в Тельца', 'в Близнецы', 'в Рака', 'во Льва', 'в Деву', 'в Весы', 'в Скорпиона', 'в Стрельца', 'в Козерога', 'в Водолея', 'в Рыбы'],
  element: {
    fire: 'инициатива и дух',
    earth: 'тело, терпение и ресурсы',
    air: 'ум, контакты и обмен',
    water: 'чувства, память и глубина',
  },
  phaseName: ['Новолуние', 'Первая четверть', 'Полнолуние', 'Последняя четверть'],
  phaseTone: [
    'заложите намерение — начинается новый цикл',
    'действуйте через сопротивление, укрепляйте начатое',
    'кульминация и ясность — скрытое становится явным',
    'отпускание и пересмотр — оставьте завершённое',
  ],
  aspectName: ['соединение', 'секстиль', 'квадрат', 'тригон', 'оппозиция'],
  aspectTone: [
    'слияние — энергии сливаются и действуют как одно',
    'возможность — открытая дверь, если сделать шаг',
    'напряжение — требует усилия и перестройки',
    'гармония — лёгкость и природный дар',
    'полярность — осознание через другого',
  ],
  phaseTitle: (phase, signIn) => `${phase} ${signIn}`,
  phaseBlurb: (tone, signIn, elem) => `${tone}. Луна ${signIn} — ${elem}.`,
  moonIngress: (signTo, elem) => ({
    title: `Луна входит ${signTo}`,
    blurb: `Эмоциональный тон переходит ${signTo} — ${elem}.`,
  }),
  planetIngress: (label, poss, signTo, elem) => ({
    title: `${label} входит ${signTo}`,
    blurb: `${label} переходит ${signTo} — ${poss} темы теперь звучат в ключе: ${elem}.`,
  }),
  retrograde: (label, poss, signIn, direct) =>
    direct
      ? {
          title: `${label} становится директным`,
          blurb: `${label} становится директным ${signIn} — ${poss} дела снова идут вперёд.`,
        }
      : {
          title: `${label} становится ретроградным`,
          blurb: `${label} становится ретроградным ${signIn} — время пересматривать и возвращаться; внешнее движение замирает.`,
        },
  aspectTitle: (l1, name, l2) => `${l1} ${name} ${l2}`,
  voc: (signTo, time) => ({
    title: 'Луна без курса',
    blurb: `Луна больше не образует аспектов до входа ${signTo} в ${time}. Не начинайте нового — завершайте, отдыхайте, осмысляйте.`,
  }),
  eclipse: (kind, signIn) =>
    kind === 'lunar'
      ? {
          title: `Лунное затмение ${signIn}`,
          blurb: `Заряженное Полнолуние ${signIn} — кульминация, которую вы не вполне контролируете; что-то выходит на свет или завершается.`,
        }
      : {
          title: `Солнечное затмение ${signIn}`,
          blurb: `Заряженное Новолуние ${signIn} — перезапуск, которым вы не вполне управляете; открывается дверь.`,
        },
}

export interface AstroText {
  label: (body: BodyName) => string
  moonPhase: (phaseIdx: number, signIdx: number) => Phrase
  ingress: (body: BodyName, signIdx: number) => Phrase
  retrograde: (body: BodyName, signIdx: number, direct: boolean) => Phrase
  aspectTitle: (b1: BodyName, b2: BodyName, aspectIdx: number) => string
  aspectTone: (aspectIdx: number) => string
  voc: (signIdx: number, time: string) => Phrase
  eclipse: (kind: 'lunar' | 'solar', signIdx: number) => Phrase
}

function build(v: Vocab): AstroText {
  const elem = (i: number) => v.element[ELEM_ORDER[i % 4]]
  return {
    label: (b) => v.body[b],
    moonPhase: (p, s) => ({
      title: v.phaseTitle(v.phaseName[p], v.signIn[s]),
      blurb: v.phaseBlurb(v.phaseTone[p], v.signIn[s], elem(s)),
    }),
    ingress: (b, s) =>
      b === 'Moon'
        ? v.moonIngress(v.signTo[s], elem(s))
        : v.planetIngress(v.body[b], v.poss[b], v.signTo[s], elem(s)),
    retrograde: (b, s, direct) => v.retrograde(v.body[b], v.poss[b], v.signIn[s], direct),
    aspectTitle: (b1, b2, a) => v.aspectTitle(v.body[b1], v.aspectName[a], v.body[b2]),
    aspectTone: (a) => v.aspectTone[a],
    voc: (s, time) => v.voc(v.signTo[s], time),
    eclipse: (kind, s) => v.eclipse(kind, v.signIn[s]),
  }
}

const CACHE: Partial<Record<Locale, AstroText>> = {}

/** Localised wording bundle for the almanac (memoised per locale). */
export function astroText(locale: Locale): AstroText {
  return (CACHE[locale] ??= build(locale === 'ru' ? RU : EN))
}
