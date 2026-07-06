# Epic course writing context — how to author an 11-chapter Learn course

**Purpose.** The complete blueprint for writing a Gaia's Choice **epic course**:
a free, 11-chapter e-course living in the Learn section, built to be the
highest-quality, most thought-out and intuitive online course in its niche.
This file is the *structure and method*; read it together with:

- [persona-context.md](persona-context.md) — *how it sounds* (RU speaks in the
  author's voice; guides sit at **medium-high register** per the calibration
  table).
- [ideology-context.md](ideology-context.md) — *what it believes* (domain
  precedence applies: Health governs food claims, Children leads on child
  topics).
- `.claude/skills/manage-site/references/content-editing.md` — house voice
  rules (truth-first, verdict-first, no hype) remain senior to everything here.

---

## 1. What an epic course is (the content model)

- **11 chapters, one chapter = one page** = one guide file per locale:
  `content/locales/en/guides/<course-slug>/<course-slug>-NN-<chapter-slug>.md`
  + the RU counterpart with the **same filename** (slug = URL; identical
  slugs keep the locale fallback working). `NN` = zero-padded chapter number
  for tidy listings. The `<course-slug>` subfolder is filesystem tidiness
  only — it plays no role in routing or epic membership (that's the tag).
- Frontmatter per chapter: `title`, `excerpt`, `date` (real authoring date),
  **`chapter: N`** (1–11 — drives display order within the epic; sorting +
  "Глава N" labels landed 2026-07-05), `tags:` with the
  **epic tag first** (membership rule), `image` optional.
- The epic itself = an entry in `site.yaml` `epics:` (`tag`, `title`, `image`,
  `blurb`) in **both** `en` and `ru`. The blurb is the course's one-line
  promise. First `epics:` entry is the default tab — keep the flagship course
  first.
- Courses share the Learn area with guide epics (e.g. founder-guide). The word
  "Epic" never appears in UI.
- **Both locales ship together.** EN is the factual source of truth; RU is the
  default locale and primary audience. Author the chapter's substance once,
  then write each language as itself (not a translation calque) — RU in her
  voice, EN in plain house voice. Glossary terms stay English per
  `content/locales/README.md`.

## 2. The 11-chapter architecture (the 20/80 spine)

The course teaches the **vital 20% of the field that produces 80% of the
results** in chapters 1–9, then uses chapters 10–11 to make the remaining 80%
*learnable* rather than to teach it.

| Chapters | Stage | What they do |
| --- | --- | --- |
| **1** | **The Gate** | The whole territory in miniature: the promise, the map of all 11 chapters, the core mental model of the field, and a **first small win** — the reader does something real before chapter 1 ends. Nobody should finish ch. 1 unsure what the course will give them. |
| **2–9** | **The Path** | Eight chapters, each = **one load-bearing capability**. Selection test for what earns a chapter: *is this concept used again by at least two later chapters?* If not, it's not in the vital 20% — cut it or demote it to a side note. |
| **10–11** | **The Summit** | Advanced. **No new fundamentals** — only synthesis: harder, real-world-messy applications that force every Path concept to work together. Written so an apt student finishes able to teach *themselves* the remaining 80%: where the depth lives, which sources are worth it, and how to test claims against their own experience (Ralston's epistemology, made practical). A struggling student can stop after ch. 9 with a complete, working foundation — say so explicitly at the end of ch. 9. |

**Sizing:** each chapter = 1–2 hours of engaged time (reading + doing),
roughly **1,800–3,500 words per locale** plus the practice task (shipped
chapters run ~1,700–3,300; RU lands ~10–15% more compact than EN at identical
substance). Never pad toward a floor — especially closing chapters, where
padding reads as hype. **3–5 new concepts per
chapter, never more** (cognitive load is the budget; depth over coverage).

## 3. The roadmap weave — «Нить» (the Thread)

The device that makes "where do I go next?" impossible to lose. Don't call it
"Roadmap" anywhere — that word is reserved for the site's `/roadmap` page
(glossary). In UI-adjacent text call it the path / «путь»; internally it's the
Thread. Four strands, all mandatory:

### 3a. The Trail block — opens every chapter

The first thing under the title, three short lines:

> **Глава 4 из 11 · Путь** — [← Глава 3: <title>](/guides/<slug>) · [Глава 5: <title> →](/guides/<slug>)
> *Вы уже умеете:* one sentence naming what the reader can already DO (not "has read").
> *Эта глава добавит:* one sentence, one capability.

Trail links use the chapter's **short title** (the course-plan table's title);
the chapter's frontmatter `title:` may carry a colon-subtitle beyond it.

Chapter 1 has no back-link; chapter 11's forward link points to the course's
closing page section ("what's next beyond this course"). The stage name (Gate
/ Path / Summit — «Врата» / «Путь» / «Вершина») appears in the Trail line, so
position *and* altitude are always visible.

### 3b. The growing artifact (the spine project)

**Every course defines ONE real artifact the learner builds across all 11
chapters** — a thing that exists in their home or life, not a notebook of
answers. (Examples of the shape: a family food rhythm posted on the fridge; a
completed toy audit + rebuilt play shelf; a packed, tested travel kit.)

- Chapter 1's first-small-win **starts** the artifact.
- Every chapter's practice adds a **visible, named piece** to it.
- Chapter 11 **completes** it and has the learner evaluate it against chapter
  1's promise.

This is the real navigation system: the learner always knows where to go next
because *their own artifact has an obvious missing piece*. The Trail block
tells them where they are; the artifact makes them want the next chapter.

### 3c. Callbacks and seeds

- **Callbacks:** from chapter 2 on, every chapter explicitly *uses* (not
  mentions — uses) at least **two named concepts from earlier chapters**, with
  a light retrieval nudge first: «Помните из главы 3, что мы назвали …? Прежде
  чем читать дальше — попробуйте вспомнить, почему.» This is spaced retrieval
  practice wearing normal clothes.
- **Seeds:** every Path chapter plants exactly **one** open question that a
  named later chapter will answer («Почему это иногда не срабатывает — глава
  7»). One, not three — seeds create pull; a scattering creates noise.
- **Named concepts:** give the course's key ideas short, memorable names in
  her register (see persona-context — she names things vividly). A callback to
  a named concept costs one word; a callback to an unnamed one costs a
  paragraph of re-explanation.

### 3d. The Bridge block — closes every chapter

Fixed order at the end of each chapter:

1. **«Теперь вы умеете»** — 3–5 bullets, all verbs, restating the chapter's
   capabilities (this is the recap *and* the self-efficacy beat).
2. **«Практика»** — the task (see §4.6).
3. **«Проверьте себя»** — 3–5 questions answerable from memory, no answers
   printed (retrieval, not review).
4. **The hook** — one sentence naming the question the next chapter answers, +
   the link. The next chapter's Trail block then picks the reader up.

## 4. Chapter anatomy (the fixed skeleton)

Use these as `##` headings in this order — consistent headings across all
chapters make the left TOC sidebar a genuine "resume where I stopped" tool
(landed 2026-07-05: sticky scrollspy TOC on desktop, collapsible above the
article on mobile, shown once a page has 3+ headings; RU headings get
transliterated anchor ids automatically).
Concepts inside the Core section get `###` subheadings.

1. **Trail block** (§3a — not a heading, just the opening lines).
2. **The hook** — a real, concrete scene or problem the reader recognizes.
   Truth-first: a real situation of the owners' or an honestly hypothetical
   one («представьте…») — never invented experience dressed as biography.
3. **The promise** — what the reader will be able to *do* after this chapter.
   Verbs, not themes.
4. **The core** — 3–5 concepts, each in the same micro-pattern: *idea → why it
   matters → concrete example → how to actually do it*. Concrete before
   abstract, always.
5. **Worked example** — apply this chapter's concepts to the spine artifact,
   start to finish, showing the messy middle (her difficulty-first honesty:
   name what's hard before showing it done).
6. **«Практика»** — the practical task. Rules: it happens **away from the
   screen** where the topic allows (kitchen, floor, outdoors, with the child);
   20–60 minutes; produces a **visible piece of the artifact**; written as
   numbered steps or a GFM checklist so it cannot be skim-read as prose; ends
   with «как понять, что получилось» — one observable success criterion.
7. **Self-check + Bridge** (§3d).

**Visuals (mandatory since 2026-07-05):** every chapter carries **1–3
visuals** that cement its core concepts — GFM tables for comparisons/reference
grids (authored inline per locale), and SVG diagrams for flows, maps, scales,
compasses, charts. Diagram **geometry is authored once as a shared template**
(`content/shared/diagrams/<name>.svg`, with `{{slot}}` tokens) and embedded in
each locale's markdown via a `` ```diagram <name> `` fenced block whose YAML
supplies the per-locale text — so geometry is never mirrored by hand. The Gate
chapter's map-of-the-course promise is delivered as an actual course-map
diagram. **Re-embedding an earlier chapter's template with new slot text is a
first-class technique**, not a shortcut: a later chapter re-running the Gate's
staircase in its formal version, or the Summit replaying the artifact timeline
in past tense, is spaced retrieval for visuals — the reader recognizes the
shape and re-derives the concept. Prefer a re-embed over a near-duplicate new
template whenever the geometry already says the right thing. Full authoring pattern (template + fenced-block syntax, CSS-var colors,
overflow audit, parity checks):
`.claude/skills/manage-site/references/content-editing.md`, "Visuals inside
guides". Visuals obey truth-first: charts draw the qualitative shape of claims
the prose already makes, never invented data points; captions add a thought,
never repeat the adjacent sentence.

## 5. Learning-science ground rules (why the skeleton is shaped this way)

- **Retrieval beats rereading** — self-checks and callback nudges force recall;
  never print the answers next to the questions.
- **Spacing is structural** — a concept taught once and reused in chapters
  n+2 and n+5 is spaced repetition without flashcards. Plan reuse when
  outlining, not after.
- **One artifact, interleaved skills** — every chapter's practice hits the same
  project from a new angle; that's interleaving with a purpose.
- **Concrete → abstract**, example → principle, never the reverse order.
- **Desirable difficulty lives in 10–11** — the Summit chapters *should* make
  the reader work; say so there, in her voice (she names fear and overrules
  it — «Страшно? Да.» is the house way to open a hard chapter).
- **1–2 h is long.** The fixed skeleton + TOC sidebar make a chapter cleanly
  resumable; explicitly tell readers that Практика can be a separate sitting.

## 6. Ideology integration (per-course)

Before outlining, pick the influences the topic activates
([ideology-context.md](ideology-context.md)) and let them shape the *outline*,
not just the sentences:

| Course territory | Who leads |
| --- | --- |
| Anything children: play, toys, education, rhythm, parenting | **Children: Steiner, Swan** (top authority) |
| Food, nutrition, consumption, materials-as-toxins | **Health: Chek, Asprey** (governs all such claims — precedence rule) |
| Nature, plants, Gaia, outdoor life | Buhner |
| Timing, rhythm, seasonality, the almanac | Daragan (cross-link `/` almanac where natural) |
| How-to-know, testing claims, practice discipline | Ralston (the Summit chapters' backbone) |
| Non-attachment, «меньше, но лучше» | Mooji (the author's touchstone) |

Standing rules: truth-first is senior to ideology; no medical claims; spiritual
claims are framed as **invitations to direct experience** («проверьте сами»),
never as facts to believe — that's Ralston applied to Buhner and Swan.
Meat-free framing follows the precedence rule in ideology-context §How-to-use.

## 7. Shipping checklist (per course)

> Producing many chapters in one run (finishing a course, or a whole new one):
> the multi-agent production workflow — brief, diagram-spec-first sequencing,
> parallel writers, verification battery — lives in
> `.claude/skills/write-epic-course/SKILL.md`. This file stays the authoring
> blueprint; that skill is how the factory runs.

- [ ] Course outline first: 11 chapter one-liners + the spine artifact + the
      concept-reuse map (which chapter reuses what) — **before** writing ch. 1.
      Include the seed list **both ways**: by origin (which chapter plants
      what) *and* as an incoming index (which seeds each chapter must answer) —
      a writer picking up chapter N needs its debts listed, not derivable.
      Store it as `context/course-plan-<course-slug>.md` (existing examples:
      `course-plan-homeopathy.md`, `course-plan-herbalism.md`) and keep its
      "Status" line current as chapters ship.
- [ ] 22 files: 11 chapters × {en, ru}, same slugs, `chapter:` 1–11, epic tag
      first in `tags`.
- [ ] `site.yaml` `epics:` entry in both locales; epic image via `task images`.
- [ ] Every chapter passes: Trail block ✓, ≤5 new concepts ✓, artifact piece ✓,
      ≥2 callbacks ✓ (ch. 2+), exactly 1 seed ✓ (Path), Bridge ✓, RU passes the
      persona 5-question test ✓.
- [ ] Seeds audit: every planted seed is actually answered in its named chapter.
- [ ] `task typecheck && task build`; spot-check the epic tab, chapter order
      1→11, prev/next links, and the TOC sidebar in a served `dist/`.
- [ ] Docs updated; **ask the owner before committing**.

## 8. Editorial notes (differing opinions, kept small per the owner's rule)

- *On the fixed 11:* a rigid chapter count can pressure padding. The fix is
  topic selection, not format change — pick territories genuinely big enough
  for 11 chapters; if an outline honestly runs short, the topic is too narrow
  for an epic (make it a standalone guide instead) rather than the chapters
  too thin. **Owner rule (2026-07-05): every course is either 5 or 11
  chapters** — a 5-chapter course maps Gate = 1 / Path = 2–4 (or 2–N−1) /
  Summit = 5; everything else (Trail, seeds, callbacks, Bridge, artifact)
  follows this blueprint unchanged. Existing 5-chapter courses: «Честный сайт
  с нуля» (`founder-guide`, `context/course-plan-building-in-public.md`),
  «Трофология» (`trophology`, `context/course-plan-trophology.md` — a
  reader-facing food-combining course after Daniel Reid, en+ru, complete
  2026-07-05) and "Inside websites like this" (`inside-websites`,
  `context/course-plan-inside-websites.md` — also EN-only by owner decision,
  the one sanctioned deviation from "both locales ship together").
- *On 1–2 h chapters:* attention research favors 25–45 min sessions; we keep
  the long chapter (it respects the reader) but the skeleton is deliberately
  built from resumable ~30-min blocks — treat Core / Worked example / Практика
  as natural session breaks.
