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

**Pattern version: this blueprint is course pattern v2.** The six courses
shipped before it (`founder-guide`, `herbalism`, `homeopathy`, `aromatherapy`,
`trophology`, `inside-websites`) were built to **v1** and stay v1 — no
retrofit; v1's record and the assessment that produced v2 live in
[course-pattern-v1.md](course-pattern-v1.md). Every course plan states its
pattern version in its header. v2 = v1 plus: the hook palette and chapter
roles (§4), the checkpoint chapter + the return (§3e), slow arcs (§3f),
pocket rules, answer pointers, the minimum honest version, and the crib
(§3d, §4).

---

## 1. What an epic course is (the content model)

- **11 chapters, one chapter = one page** = one guide file per locale:
  `content/locales/en/compass/<epic>/NN-<chapter-slug>.md`
  + the RU counterpart with the **same filename** (slug = URL; identical
  slugs keep the locale fallback working). `NN` = zero-padded chapter number
  for tidy listings — the filename carries **no** epic prefix. The `<epic>`
  subfolder **is** part of the route — URL = `/compass/<epic>/NN-<chapter-slug>`
  — while epic *membership* (which course groups the chapter on the landing
  page) is set by the first `tags:` entry, not the folder.
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
- **Cross-course links (standing practice):** the Compass courses share one
  epistemology — direct experience over received opinion — taught through
  different domains. Link between courses wherever it genuinely *deepens*
  understanding (e.g. aromatherapy's volatile fraction vs herbalism's whole
  plant); earned links only, never SEO-style interlinking.

### 3d. The Bridge block — closes every chapter

Fixed order at the end of each chapter:

1. **«Теперь вы умеете»** — 3–5 bullets, all verbs, restating the chapter's
   capabilities (this is the recap *and* the self-efficacy beat). **Path
   chapters open this section with the pocket rule** — one bolded,
   blockquoted sentence: the chapter's whole capability compressed into a
   decision instrument the reader can quote from memory a year later («Если
   плавает — жди и встряхивай», "the label IS the safety system"). One per
   Path chapter, frozen in the course plan, restated verbatim in the crib
   (§4.8). A pocket rule is a *rule*, not a slogan — it must decide something.
2. **«Практика»** — the task (see §4.6).
3. **«Проверьте себя»** — 3–5 questions answerable from memory, no answers
   printed (retrieval, not review). **Every question ends with an answer
   pointer** — the address, never the answer: *(гл. 3 → «Минеральный
   ключ»)*. A reader who blanks gets a place to go instead of a dead end;
   a reader who recalls never needs it.
4. **The hook** — one sentence naming the question the next chapter answers, +
   the link. **Tie it to the artifact whenever possible**: name the visible
   gap the reader's own artifact now has («на полке есть банки — но какие из
   них можно доверить детской коже?») rather than abstract curiosity. The
   next chapter's Trail block then picks the reader up.

### 3e. The checkpoint chapter + the return

v1's continuity looked mostly backward (callbacks) and its artifact only ever
grew — early pieces fossilized at early-chapter skill. v2 adds one
consolidation point per course:

- **11-chapter courses:** the plan designates ONE mid-Path chapter (ch. 5–7)
  as the **checkpoint**. It opens, right after the Trail block, with the
  **gate quiz** — 5 retrieval questions spanning *all* previous chapters
  (not just the last one), each with an answer pointer (§3d.3). Its practice
  performs **the return**: instead of adding a new artifact piece, the reader
  takes one *named early piece* back to the bench and upgrades it with
  everything learned since — re-encoding, transfer, and the honest lesson
  that revision is half of craft. The chapter still teaches (role `concept`
  or `protocol` inside), but its practice budget belongs to the return.
- **5-chapter courses:** a lighter beat, not a whole chapter — chapter 3 or 4
  opens with a 3-question gate quiz and its practice includes one return
  element alongside its new piece.

The plan freezes which chapter is the checkpoint and which early piece the
return revisits. A course may add further returns where the domain invites
them; the checkpoint's is mandatory.

### 3f. Slow arcs

Where the domain has processes that take real calendar time — a tincture
maturing, timber drying, a seed stratifying, a moisture reading repeated
across weeks — the plan schedules them deliberately: **set in chapter N,
check or harvest in chapter M**. A slow arc is the strongest continuity
device a course can own: the reader's kitchen/workshop physically contains
a thing addressed to a future chapter. At least one slow arc per course
*where the domain allows it* (screen-bound or purely conceptual topics are
exempt — never fake one). The arc's set-point and harvest-point are frozen
in the plan; the harvesting chapter must actually harvest (a set-and-forgotten
jar is worse than none).

## 4. Chapter anatomy (the fixed skeleton)

**Eight `##` headings per chapter, always.** Headings 2–8 keep the same
titles across the whole course — consistent headings make the left TOC
sidebar a genuine "resume where I stopped" tool (sticky scrollspy TOC on
desktop, collapsible above the article on mobile, shown once a page has 3+
headings; RU headings get transliterated anchor ids automatically). **The
first heading is the one v2 frees:** its title is chapter-specific, set by
the chapter's hook (below). The count stays exactly 8 — that's what the
verification greps check. Concepts inside the Core section get `###`
subheadings.

1. **Trail block** (§3a — not a heading, just the opening lines). The
   checkpoint chapter's gate quiz (§3e) follows immediately after it.
2. **The hook** — first `##` heading, title chapter-specific. v1 opened every
   chapter with the same beat; v2 assigns each chapter one hook type from a
   closed palette of four, frozen in the plan, **never the same type in two
   adjacent chapters**:
   - **Scene** — a real, concrete situation the reader recognizes (the v1
     default, still the workhorse).
   - **Misconception autopsy** — open with the wrong belief most readers
     carry, stated fairly, then take it apart («считается, что сруб гниёт —
     считается неверно, и вот где ошибка прячется»).
   - **Artifact in trouble** — start from the reader's own artifact: the
     piece they built is now insufficient, ambiguous, or failing, and this
     chapter is what fixes it.
   - **Open question** — a question the reader *should* be able to answer by
     now and provably can't; the gap is the hook. (Natural fit for the
     checkpoint chapter.)
   Truth-first applies to all four: a real situation of the owners' or an
   honestly hypothetical one («представьте…») — never invented experience
   dressed as biography.
3. **The promise** — what the reader will be able to *do* after this chapter.
   Verbs, not themes.
4. **The core** — shaped by the chapter's **role**, assigned in the plan:
   - **`concept`** (the default) — 3–5 concepts, each in the same
     micro-pattern: *idea → why it matters → concrete example → how to
     actually do it*. Concrete before abstract, always.
   - **`gallery`** — the catalog chapter (ten herbs, eight wood species): the
     core is a run of short portraits in ONE fixed per-item format defined in
     the plan (v1 forced these through the concepts mold; the kitchen-ten
     visibly strained). Still ≤5 *new concepts* — the portrait format itself
     is usually one of them; the items are instances, not concepts.
   - **`protocol`** — the decision chapter (matching X to the situation):
     the core builds one decision instrument — a tree, a table, a go/no-go
     sequence — and walks it through contrasting cases.
   Roles reshape the *inside* of the core and practice only; the 8-heading
   skeleton never changes. A course is mostly `concept` chapters — use the
   other roles where the material genuinely has that shape, not for variety's
   own sake.
5. **Worked example** — apply this chapter's concepts to the spine artifact,
   start to finish, showing the messy middle (her difficulty-first honesty:
   name what's hard before showing it done).
6. **«Практика»** — the practical task. Rules: it happens **away from the
   screen** where the topic allows (kitchen, floor, outdoors, with the child);
   20–60 minutes; produces a **visible piece of the artifact**; written as
   numbered steps or a GFM checklist so it cannot be skim-read as prose; ends
   with «как понять, что получилось» — one observable success criterion.
   **Plus the minimum honest version:** one marked line — «Если сегодня нет
   сил:» / "Short on time:" — naming a 10–15-minute cut that still moves the
   artifact visibly. Not homework-lite: the honest minimum. A stalled
   artifact turns the course's pull into guilt; the minimum keeps the chain
   unbroken.
7. **Self-check + Bridge** (§3d).
8. **The crib** (final chapter only, inside its worked-example or core
   section): the whole course on one page — every named concept with a
   one-line reminder, every pocket rule verbatim, and the course-map diagram
   re-embedded in past tense. The reader is told to copy or print it and
   keep it *with the artifact* — the named-concept vocabulary the course
   built finally becomes a physical reference the reader owns, instead of
   evaporating at the last Bridge.

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
- **Consolidation beats accumulation** — the checkpoint's gate quiz and the
  return (§3e) force the reader to hold the whole earlier course together
  once, mid-way, when it's cheap to repair a gap — not discover it in the
  Summit. Revising an early artifact piece re-encodes it at current skill.
- **A prediction across time is the deepest retrieval** — slow arcs (§3f)
  make the reader write down an expectation and meet it chapters later;
  being wrong on paper teaches more than being told.
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
**Symmetric skepticism:** "science says" / "peer-reviewed" earns the same
scrutiny as tradition and marketing — often bought or dogmatic Scientism
(Buhner's *Plant Intelligence* closing chapters; Chek's respect-yet-verify).
Never present "studies show" as a trump card; direct verified experience
arbitrates — Ralston applied to institutional science, the mirror of applying
it to Buhner and Swan.
Meat-free framing follows the precedence rule in ideology-context §How-to-use.
Before saving ideology integrated upon course plan - ask the owner for feedback. Just in case. That during-creation feedback overrides everything.

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
      **v2 plans also freeze:** pattern version in the header, per-chapter
      **role** and **hook type** columns (no hook type twice in a row), the
      **checkpoint chapter + which early piece its return revisits**, the
      **slow arcs** (set-chapter → harvest-chapter, or the explicit "domain
      has none"), and every Path chapter's **pocket rule** verbatim.
      Store it as `context/course-plan-<course-slug>.md` (existing examples:
      `course-plan-homeopathy.md`, `course-plan-herbalism.md`) and keep its
      "Status" line current as chapters ship.
- [ ] 22 files: 11 chapters × {en, ru}, same slugs, `chapter:` 1–11, epic tag
      first in `tags`.
- [ ] `site.yaml` `epics:` entry in both locales; epic image via `task images`.
- [ ] Every chapter passes: Trail block ✓, exactly 8 `##` headings (heading 1
      free-titled per its hook, 2–8 fixed) ✓, hook type + role per the plan ✓,
      ≤5 new concepts ✓, artifact piece ✓, minimum honest version in the
      practice ✓, ≥2 callbacks ✓ (ch. 2+), exactly 1 seed ✓ (Path), Bridge
      with pocket rule (Path) + answer pointers ✓, RU passes the persona
      5-question test ✓.
- [ ] Checkpoint chapter: gate quiz spans all prior chapters ✓; the return
      revisits the piece the plan names ✓. Final chapter carries the crib ✓.
- [ ] Seeds audit: every planted seed is actually answered in its named
      chapter. Slow-arc audit: every set jar/board/bed is harvested in its
      named chapter.
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

Before saving editorial notes upon course plan - ask the owner for feedback. Just in case. That during-creation feedback overrides everything.
