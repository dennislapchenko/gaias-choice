# Course plan — «Ароматерапия» (RU), succinct rebuild

**Pattern version: v3.** **Status: pilot — chapter 1 drafted for owner review;
the live 11-chapter course is untouched.** RU only for now; EN stays on the
live v1 course until this shape is approved.

## Why this rebuild exists

A native reader skimmed RU chapters 1–3 of the live course and reported "90%
water, no substance, gained nothing". Measured, the complaint is exact:

| Live chapter | Core words | Facts / 1,000 core words | Epistemology mentions |
|---|---|---|---|
| 1 «Что такое живой аромат» | 1,362 | **1.5** | **22** |
| 2 «Как работает запах» | 990 | **0.0** | 7 |
| 3 «Кожа и доза» | 1,092 | 23.8 | 2 |

(Measured with `task density`; floor is 12. Chapter 5 scores 1.5 with **42**
epistemology mentions — the worst in the course.) Chapter 3, the one chapter
that teaches dilution, is the only one of the three that measures as teaching
at all. The cause is not the v2 upgrade (it changed
~10 lines per chapter) and not the translation. The cause is that **the course
taught its epistemology instead of its subject**, and an 11-chapter budget
forced padding onto a domain with ~5 chapters of real content.

Full diagnosis and the general rules that came out of it:
[epic-writing-context.md](../epic-writing-context.md) §0 (pattern v3).

## The new shape — 5 chapters, two stages

Stages are **Основа** (chapters 1–4, the vital 20%) and **Вершина** (chapter 5).
There is no separate framing "Gate": chapter 1 is a working chapter that hands
over a usable instrument before it explains anything about itself.

| # | Slug | Title | Stage | Role | The instrument it hands over |
|---|------|-------|-------|------|------------------------------|
| 1 | `01-flakon-i-doza` | «Флакон и доза» | Основа | protocol | The dilution rule + how to read a label. After chapter 1 the reader can buy correctly and mix safely — the whole 80/20 in one chapter. |
| 2 | `02-desyat-masel` | «Десять масел» | Основа | gallery | Ten portraits: Latin name, marker molecule, what it does, dose, safety flag, shelf life. |
| 3 | `03-kak-primenyat` | «Как применять» | Основа | protocol | Methods with real numbers: diffuser, inhaler, steam, roller, bath, compress — drops, minutes, frequency. |
| 4 | `04-komu-nelzya` | «Кому нельзя» | Основа | protocol | The red lines with ages, percentages and mechanisms — children, pregnancy, cats, dogs, phototoxicity, sensitisation. |
| 5 | `05-smesi-i-chestnyy-flakon` | «Смеси и честный флакон» | Вершина | concept | Blending architecture + judging a supplier + where real depth lives. |

Safety is not deferred: the dose instrument is chapter 1, the population limits
are chapter 4, and chapter 1 carries an explicit "children, pregnancy, animals →
chapter 4, and until you have read it, don't" line.

## Spine artifact — the working shelf

Physical, countable: **ten labelled bottles + one correctly diluted roller +
the red-lines card + one blend of your own.** The smell journal survives as a
*tool* mentioned in one short paragraph — never again as a curriculum item with
its own taught columns.

## Named concepts (five, hard cap)

| Concept | Born in | Why it earns a name |
|---|---|---|
| доза решает | 1 | The one rule that prevents most harm |
| семья молекул | 2 | Lets a nose predict an unknown oil |
| окисление | 1 (named), 4 (consequences) | Explains shelf life AND why old oil is more dangerous, not just weaker |
| красные линии | 4 | The non-negotiable population limits |
| верх · сердце · база | 5 | The blending architecture |

Everything else is a fact, a procedure or a portrait — not a named concept.

## Pocket rules (one per Основа chapter, verbatim)

- ch. 1: **«Не бывает безопасных масел — бывают безопасные проценты.»**
- ch. 2: **«Сначала семья, потом имя, потом проверка носом.»**
- ch. 3: **«Вдыхают чаще, чем мажут; мажут — только в основе.»**
- ch. 4: **«Чем меньше тело — тем ниже процент; для самых маленьких — ноль и врач.»**

## What was cut, and why (the refactor record)

| Cut | Was | Why |
|---|---|---|
| **лестница доверия** as taught content | Its own core section in ch. 1, re-taught in every chapter (22 mentions in ch. 1, 42 in ch. 5) | Epistemology is a **stance**, not curriculum. Stated once in two sentences, then applied silently. |
| «где наука кончается» section | ~400 words of ch. 2 | Same reason. One honest sentence where a claim is genuinely thin. |
| «помощь и усиление» | A named concept + a core section | Vocabulary with no payload — renaming "calming" and "energising" taught nothing. |
| «путь через нос» as a chapter | All of ch. 2 (~1,750 words) for one anatomical fact | Compressed to one paragraph in ch. 3 where it explains why inhalation is the main route. |
| Journal's three taught columns | Core sections across chapters | Kept as a tool in one paragraph. |
| Chapters 6–11's separate "directions" | Calm/sleep, focus/energy, care | Folded into the ten portraits (ch. 2) and the methods table (ch. 3) — that is where a reader actually looks them up. |

**Net:** ~22,000 words → ~9,000, with more teachable content, not less.

## Fact bank — chapter 1 (use these; invent no numbers)

Everything below is standard, published aromatherapy-safety material,
consistent with the live course. **Safety-critical values are marked 🔒 — never
alter, round or "improve" them.** If a number is not here and not already in
the live course, do not state it.

**What is in the bottle**
- Эфирное масло = летучая фракция растения: от нескольких десятков до
  нескольких сотен соединений в одном флаконе.
- Способы извлечения: паровая дистилляция (большинство), холодный отжим
  (цитрусовая кожура), CO₂-экстракция, абсолю (растворитель — жасмин, роза).
- Выход и цена: лаванда — ~100–150 кг сырья на 1 кг масла; роза — ~3 000–5 000 кг
  лепестков на 1 кг масла; апельсиновая кожура — высокий выход, поэтому дёшево.
  **Цена честного флакона идёт за выходом, а не за брендом.**

**Чтение этикетки**
- Что обязано быть: латинское имя (*Lavandula angustifolia*), часть растения,
  страна, способ извлечения, номер партии, тёмное стекло.
- 🔒 «Отдушка», «parfum», «fragrance oil», «ароматическое масло» = синтетика.
  Это не сорт похуже, это другой продукт.

**Доза — инструмент главы**
- 🔒 1 мл ≈ 20 капель.
- 🔒 1% = 1 капля на 5 мл основы.
- 🔒 Роллер 10 мл: 1% = 2 капли, 2% = 4 капли, 3% = 6 капель.
- 🔒 Взрослый, тело, короткий курс: 2–3%.
- 🔒 Лицо, чувствительная кожа, ежедневное применение, пожилые: 0,5–1%.
- 🔒 Дети от 2 лет: 0,5–1%. До 2 лет — только со специалистом.
- 🔒 Неразведённое на кожу — нет. Не «крепче», а другая категория риска.

**Три вещи, которые может сделать неразведённое масло**
- 🔒 Раздражение — сразу, как ожог.
- 🔒 Сенсибилизация — иммунная реакция, может остаться навсегда; одна
  неосторожная неделя стоит масла на всю жизнь.
- 🔒 Фототоксичность — отжатые цитрусы на коже + ультрафиолет (подробности и
  проценты — глава 4).

**Основы (масла-носители)**
- Жожоба — жидкий воск, очень стабилен, ~5 лет.
- Фракционированный кокос — очень стабилен, без запаха.
- Сладкий миндаль — ~1 год.
- Абрикосовая косточка — ~1 год.

**Хранение и срок годности**
- Тёмное стекло, прохлада, плотно закрытая крышка. Не в ванной (тепло + пар).
- Цитрусовые и хвойные (богаты монотерпенами): 1–2 года.
- Лаванда, ромашка, герань, розмарин: 2–3 года.
- Мята: ~3 года (ментол стабилен).
- Сандал, пачули, ветивер: с возрастом становятся лучше.
- 🔒 **Окисление:** монотерпены на воздухе окисляются, и продукты окисления —
  сенсибилизаторы. Старое цитрусовое масло не «слабее» — оно **опаснее**
  свежего. Это главная причина, по которой флакон закрывают и датируют.

**Практика (chapter 1's own):** смешать роллер 10 мл, 2% = 4 капли лаванды в
жожоба; подписать: масло, процент, основа, дата открытия флакона.

## Fact banks — chapters 2–5 (outline level, for when they are written)

- **Ch. 2, the ten:** лаванда *Lavandula angustifolia* (линалоол, линалилацетат);
  апельсин сладкий *Citrus sinensis* (лимонен ~95%, **не** фототоксичен);
  мята *Mentha × piperita* (ментол); чайное дерево *Melaleuca alternifolia*
  (терпинен-4-ол — ISO 4730 требует ≥30%, 1,8-цинеол ≤15%); эвкалипт
  *Eucalyptus globulus* (1,8-цинеол ~70–85%); ромашка римская *Chamaemelum
  nobile* (эфиры); лимон *Citrus limon*, отжим (лимонен, фототоксичен); ладан
  *Boswellia carterii* (α-пинен); розмарин *Rosmarinus officinalis*
  (1,8-цинеол / камфора, хемотипы); герань *Pelargonium graveolens*
  (цитронеллол, гераниол — сенсибилизатор).
- **Ch. 3, methods:** ультразвуковой диффузор 3–5 капель на 100 мл воды,
  30–60 мин с перерывами, проветривать; персональный ингалятор 5–15 капель на
  фитиль; паровая ингаляция 1–2 капли, глаза закрыты, 5–10 мин (не детям);
  роллер 10 мл 2% = 4 капли; 🔒 ванна — масла не растворяются в воде: 4–6 капель
  развести в 1 ст. л. основы, молока или солюбилизатора; компресс 3–5 капель на
  миску с дисперсантом; массаж 1–2% на большую площадь.
- **Ch. 4, red lines:** 🔒 до 2 лет — только специалист; 2–6 лет 0,5%; мята и
  эвкалипт не к лицу ребёнка до 6 (ментол, 1,8-цинеол); беременность — избегать
  розмарин и сильные масла, вдыхание в низкой дозе, консультация до кожи; кошки
  — дефицит глюкуронирования (UGT1A6), чайное дерево токсично, диффузор только
  там, откуда кошка может уйти; собаки — разводить сильнее, дать уйти;
  фототоксичность IFRA leave-on: лимон отжим 2%, бергамот 0,4%, лайм отжим 0,7%,
  грейпфрут 4%, без УФ 12–18 часов; патч-тест 24 часа; «поддержка, не лечение».
- **Ch. 5, pinnacle:** скорость испарения → верх/сердце/база; стартовое
  соотношение и ведущее масло; синергия; GC/MS и номер партии; адюльтерация
  (разбавление носителем, синтетический линалоол); Tisserand & Young «Essential
  Oil Safety» как справочник, ISO-стандарты, чтение GC/MS.

## Voice and structure rules for this rebuild

- Chapter length **1,200–1,800 words** — shorter than v1/v2 on purpose.
- **≥20 quantified facts per 1,000 core words** (`task density`; the general
  floor is 12, but a dosing course carries numbers and should clear 20 — the
  drafted chapter 1 reaches 37.5).
- Scaffolding ≤20% of the chapter (v1/v2 ran 27–33%).
- Heading skeleton stays 8 `##` so the TOC and the checks keep working.
- Author's voice per `persona-context.md` — warm, direct, difficulty-first.
  Density is the fix, **not** coldness: facts arrive inside real sentences and
  real situations, never as a bare datasheet.
- No medical claims. Support, never treatment.
- Epistemology: **two sentences, once, in chapter 1.** Then never again as a
  topic — only as the reason a claim is stated carefully.

## Migration (when approved)

The live RU course is 11 chapters at existing URLs. Replacing it with 5 means
6 URLs stop existing — decide then whether to redirect, keep them as an
archive, or accept the 404s. Nothing is deleted until the owner approves the
shape. EN follows only after RU is settled.
