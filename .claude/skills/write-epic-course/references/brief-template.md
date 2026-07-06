# Master brief — template

Write this to the session scratchpad as `<course>-brief.md` before spawning
any agent. Everything in [brackets] is per-course; everything else is the
frame that made the herbalism run drift-free. Keep the brief self-contained —
agents start cold and read nothing you don't point them at.

```markdown
# Master brief — [Course], chapters [N–M] (en+ru)

You are writing chapters of «[RU course title]» / "[EN course title]" for
Gaia's Choice. Repo: [absolute path]

## MUST READ before writing (in this order — no skipping)

1. `context/course-plan-[slug].md` — titles, one-liners, named concepts,
   concept-reuse map, seeds, heading skeleton, ideology integration. FOLLOW IT.
2. `context/epic-writing-context.md` — the blueprint (Trail, artifact,
   callbacks/seeds, Bridge, anatomy, sizing).
3. Existing chapters, BOTH locales, to match voice/structure exactly: [paths]
4. `context/persona-context.md` — RU voice DNA + 5-question test.
5. `context/ideology-context.md` — worldview; [who leads which chapter].
6. `.claude/skills/manage-site/references/content-editing.md` — "Voice and
   standards", "Add a Compass chapter", "Visuals inside guides".
7. The diagram spec: [scratchpad path] — exact slot lists for every diagram
   your chapters embed. Fill EVERY slot + `caption`.

## Files to create (per chapter: same slug in both locales)

[paths]. Frontmatter (quote any title/excerpt containing a colon — an
unquoted colon is a YAML error that blanks the whole SPA):
title, excerpt, image: /images/guide-<slug>.svg, date: [one fixed date],
chapter: N, tags: [[epic-tag]]

## Fixed chapter table (slugs, SHORT titles both locales, stage)

[The full table for ALL chapters incl. existing ones — Trail links use these
short titles verbatim; frontmatter titles may add colon-subtitles.]
[Last chapter: back-link only; its Next section closes the course — no
invented forward link.]

## Heading skeleton (fixed — feeds the TOC; do not rename)

[EN + RU skeletons from the course plan.]

## Non-negotiables

- [word range] per chapter per locale; 3–5 new concepts max; 1–3 visuals.
- ≥2 named-concept callbacks with a retrieval nudge; Path chapters plant
  EXACTLY one seed; answer incoming seeds explicitly (lists below).
- Practice: away from screen, 20–60 min, checklist form, visible artifact
  piece, ends with the observable success criterion.
- EN and RU same substance, each written as itself — RU in her voice, EN
  plain house voice. No calque either direction.
- No medical claims. No invented biography; hypotheticals as «представьте».
- Diagram embeds fill every spec slot; captions add a thought, never repeat
  adjacent prose; RU text within the spec's char limits.
- Don't touch src/, site.yaml, or other chapters.

## Incoming seeds each chapter MUST answer
[inverse index: chapter → seeds it owes, quoted verbatim from the plan]

## Seeds each Path chapter plants (exactly one)
[origin index; Summit chapters plant none]

## [Fixed casts the course commits to]
[e.g. the ten herbs — "do not add beyond it", with exclusions named]

## [Domain non-negotiables — safety lines etc.] WITH placement
[fact → "state in ch. N's X, recall in ch. M's Y" for every one]

## Chapter content briefs
[per chapter: the plan's one-liner expanded with specifics — worked-example
subjects, artifact piece, which diagram + which GFM table, ideology leads,
any "explicit line the blueprint requires here" (e.g. ch. 9's you-can-stop-here)]

## Definition of done (per agent)
- files written; frontmatter valid; skeleton exact; Trail + Bridge complete;
- diagram slots complete per spec; seeds/callbacks/safety per this brief;
- RU passes the persona test;
- report: files, word counts, where seeds/callbacks/safety landed, and any
  deviation WITH its reason.
```

## Writer-prompt frame (per agent — use verbatim, fill the brackets)

The prev/next restatement is belt-and-braces on top of the brief's frozen
table: agents of adjacent pairs finish at different times, and a writer that
skims the table will still get its own neighbors right from the prompt.

```
You are writing chapters [A] and [B] of "[Course]" (both locales) for
Gaia's Choice. Repo: [absolute path].

Read FULLY before writing anything: the master brief at
[scratchpad path]/[course]-brief.md, then the diagram spec it points to.
Follow the brief exactly — it freezes every cross-chapter fact.

Create exactly these 4 files, nothing else:
- content/locales/en/compass/[epic]/[slug-A].md
- content/locales/ru/compass/[epic]/[slug-A].md
- content/locales/en/compass/[epic]/[slug-B].md
- content/locales/ru/compass/[epic]/[slug-B].md

Your neighbors from the frozen table (use these exact short titles in
Trail links): before [A] comes [slug, short title en/ru]; after [B] comes
[slug, short title en/ru]. Frontmatter date: [date]. Images
/images/guide-[slug].svg already exist — reference, don't create.

Do NOT: run task/npm/build commands, commit, touch any other file, add
items beyond the brief's fixed casts, leave any diagram-spec slot
unfilled, or resize/edit the spec's examples.

Before reporting, self-audit every file: exactly 8 `## ` headings; every
spec slot present in each diagram embed; any title/excerpt containing a
colon is quoted; Path chapters plant exactly one seed; every incoming
seed from the brief is explicitly answered.

Report back: files written, per-locale word counts, where each seed /
callback / safety line landed, and every deviation from the brief WITH
its reason. Deviations for good cause are fine; unreported ones are not.
```
