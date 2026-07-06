---
name: write-epic-course
description: Multi-agent production workflow for writing Gaia's Choice Compass course chapters at scale — batch-writing many chapters (en+ru) with their shared diagrams and mandala art, in parallel, with full verification. Use whenever the owner asks to write, finish, continue, or extend a Compass course — "finish the homeopathy chapters", "write chapters 4–11", "new course on X", "next course chapter(s)" — even for a single new chapter, since the sequencing rules (diagrams-before-prose, link flips, verification battery) apply at any batch size. Not for editing prose inside an existing chapter (that's a normal content edit via manage-site).
---

# Writing epic-course chapters — the production workflow

How to manufacture Compass course chapters without losing the qualities that
make them worth reading. The **authoring blueprint** (chapter anatomy, Thread,
artifact, sizing) is `context/epic-writing-context.md`; the **house rules**
(truth-first, provenance, container-only npm) are `manage-site` SKILL.md.
This skill is only the *production process* — proven on the herbalism course
(chapters 4–11, 16 files, one session).

## Why this shape

Chapters cross-reference each other (Trail links, seeds, named concepts) and
both locales must ship together, so naive parallel writing produces drift.
The fix is to **freeze every cross-chapter fact before any prose is written**,
then parallelize freely inside those walls.

The process is deliberately model-portable: everything that made past runs
good is written down — in this skill, the brief template, the verification
commands, and the blueprint. **Trust the checklists over instinct**: when a
step feels skippable or a command feels rewritable, re-read the step's "why"
before deviating, and prefer following it as written. Spawn writer agents on
the strongest model available to you; the brief carries the quality either
way.

## Phase 0 — absorb, then freeze (main session)

Read: the course plan (`context/course-plan-<slug>.md`), the blueprint, ALL
existing chapters of the course in BOTH locales, `persona-context.md`,
`ideology-context.md`, and content-editing.md's "Visuals inside guides".

Then write the **master brief** to the session scratchpad — the single
document every agent works from. Template with the non-obvious parts marked:
[references/brief-template.md](references/brief-template.md). The freeze list
(if any of these is left to a writer's judgment, chapters will disagree):

- the full chapter table: slug, **short title** (used in Trail links) and full
  colon-subtitle freedom, stage, both locales;
- the seed graph **both directions** — planted by / must be answered in;
- per-chapter visual assignments (which diagram, which GFM table);
- domain non-negotiables (safety lines etc.) *with placement* — "state X in
  ch. N's portrait and recall it in ch. M" beats "mention X somewhere";
- fixed casts/lists the course commits to (e.g. herbalism's ten herbs) so no
  writer "helpfully" adds an eleventh;
- frontmatter date and image paths.

**Readiness gate:** don't start writing the brief until you can answer from
memory — what artifact the course builds chapter by chapter, every chapter's
short title in both locales, and which seeds are open and where each must be
answered. If you can't, read again. A brief written while skimming produces
agents that quietly disagree, and the disagreements surface only in Phase 3
when they're expensive to fix.

## Phase 1 — visuals before prose (one agent)

One agent creates the new shared diagram templates
(`content/shared/diagrams/`), writes a **slot spec** to the scratchpad, and
adds+generates the chapter mandala entries (`scripts/generate-mandala.mjs`
SETS + `task mandalas SET=guides`).

Why first: writers fill diagram slots sight-unseen from the spec, so the spec
must exist before they start; and image paths in frontmatter must resolve.
Spec requirements per diagram: full slot list with position/meaning, **max
char count per slot calibrated to RU** (EN runs narrower — say so in the spec,
or writers will "fix" EN examples that exceed the numbers), and one filled
example embed. Prefer **re-embedding an existing template** with new slot text
over a near-duplicate new one (see blueprint §4 Visuals for why).

## Phase 2 — parallel writers (2–4 agents)

Each agent owns **adjacent chapter pairs** (4–5, 6–7, 8–9, 10–11): most seed
arcs are pair-internal, so pairing minimizes cross-agent reasoning. Each agent
writes its chapters in BOTH locales (same substance, each language written as
itself — splitting locales across agents breaks lockstep).

Every writer prompt: use the verbatim frame at the end of
[references/brief-template.md](references/brief-template.md) — it points at
the brief + spec, names the agent's files, restates its prev/next neighbors
from the frozen table, forbids touching anything else, requires a pre-report
self-audit (heading count, slot completeness, quoted colons, seed
plant/answer), and requires a deviation report. Writers may deviate for good
reasons (a word floor that would force padding); they must *report* it, not
hide it.

Meanwhile the main session does the central edits no agent owns: flip the
previous last chapter's "*in preparation*" Trail + Next links to real links
(both locales).

## Phase 3 — verification battery (main session)

Exact copy-paste commands, JS snippets, and pass criteria for every step:
[references/verification.md](references/verification.md) — run them as
written rather than composing your own. Each step catches a different
failure class:

1. **Diagram parity + template existence** — the two commands in
   content-editing.md "Verify parity" (remember: `inside-websites` EN-only
   diagrams are an expected asymmetry).
2. **Structure greps**: `chapter:` frontmatter 1..N in both locales; heading
   skeleton count (8 × `## ` per chapter); `image:` paths exist.
3. **Link graph**: every `(/compass/<slug>)` reference resolves to a real
   file; each mid-course chapter is referenced ~3× (prev-link, Trail next,
   hook), the last chapter ~2×.
4. **Truth-first sweep**: grep the new files for invented-experience patterns
   ("we spent", "months on the road", «мы провели»…) and medical-claim verbs
   (cure/heal/лечит/вылечи) — expect only benign hits, read each.
5. `task typecheck && task build`.
6. **In-browser audit** on served `dist/` — per new page × per locale: no
   `⚠` figcaptions, no SVG text overflow, TOC renders, epic tab lists 1→N.
   (A plain static server has no SPA fallback; the client-side navigation
   recipe is in verification.md §6.)
7. **Spot-read** at least one full RU chapter (pick the most sensitive one)
   against the persona 5-question test — greps can't judge voice.

## Phase 4 — docs, then the owner

Same session, before declaring done: course-plan Status line; CLAUDE.md course
lists (two places: Compass section + "Current content state"); the course line
in content-editing.md; the public roadmap **in both locales** (+ checkbox
parity check + footers). Then report and **ask before committing** — ship via
the background-agent procedure in manage-site SKILL.md.

## Traps (each of these has actually been attempted or nearly shipped)

- **Padding toward a word floor.** The blueprint's range is a range; closing
  chapters especially run short on purpose. Thin content stretched to a
  number reads as exactly that.
- **Calquing between locales.** RU is written in the author's voice
  (persona test), EN in plain house voice — same substance, neither is a
  translation of the other. If an RU sentence only makes sense after
  back-translating it to English, it fails.
- **Unquoted colon in `title:`/`excerpt:`.** A YAML error in one file blanks
  the whole SPA. Quote any value containing a colon.
- **Extending a fixed cast.** If the course commits to ten herbs, no writer
  adds an eleventh, however helpful it seems — the cast is a curriculum
  decision, not an oversight.
- **A forward link out of the last chapter.** The final chapter closes the
  course: back-link only. (Conversely: a mid-write course's last shipped
  chapter keeps its "next" as text-only until the next chapter exists.)
- **"Fixing" spec examples.** The diagram spec's char maxima are calibrated
  to RU; its EN examples may exceed them and that's fine. Writers change
  their own slot text to fit, never the spec.
- **Declaring done at green build.** `task typecheck && task build` passing
  says nothing about `⚠` figcaptions, overflowing SVG text, or a broken link
  graph — those only surface in the Phase 3 browser audit.

## Costs, honestly

The herbalism run: 1 diagram agent + 4 writer agents (~100–165k tokens each),
~15 min wall-clock for writing, plus main-session orchestration and
verification. Cheap relative to hand-writing 16 files; not cheap in absolute
terms — don't spawn the fleet for a one-chapter job (one writer agent + the
same phases 0/1/3/4 is enough).
