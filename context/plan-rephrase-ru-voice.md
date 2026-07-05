# Plan: rephrase all Russian content in the author's voice

**Status:** done (executed 2026-07-05). Tier 1–3 files rephrased in voice;
Tier 4 (privacy/disclosure) left untouched — already plain and human, no
corporate-translation smell to fix. `task typecheck && task build` green.
**Goal:** the current RU content is a competent but soulless translation of the
EN source. Rephrase every Russian text so a living person — the author
described in [persona-context.md](persona-context.md) — is speaking, without
changing a single fact and without breaking house rules.

## Required reading, in order (do not skip)

1. `.claude/skills/manage-site/SKILL.md` — invoke the manage-site skill first,
   as always.
2. [context/persona-context.md](persona-context.md) — **the core input.** The
   voice DNA, register-calibration table, anti-patterns, and the 5-question
   test at the end are the acceptance criteria for every paragraph.
3. [context/ideology-context.md](ideology-context.md) — worldview; mostly
   affects framing word choices (e.g. nature as kin, non-attachment root of
   «меньше, но лучше»). No new claims may be introduced from it.
4. `content/locales/README.md` — the do-not-translate glossary (Roadmap stays
   Roadmap, etc.). Rephrasing must not calque terms back into Russian.
5. `.claude/skills/manage-site/references/content-editing.md` — house voice
   rules (verdict-first, every review names a flaw, no hype, nothing fictional).

## Scope — files to rephrase

All under `content/locales/ru/`, in this priority order:

### Tier 1 — her voice matters most (do first, deepest rework)
| File | Notes |
| --- | --- |
| `ru/site.yaml` | tagline, description, mission, `values[].title/text`, epic `blurb`. Keys/structure untouched. This text is on every page. |
| `ru/pages/about.md` | ⚠️ Carries the fictional "7 months in a camper" persona (banned; slated for truthful rewrite per roadmap Phase 0). **Rephrase voice only — do not deepen the fiction.** Where the fake persona speaks, keep it minimal/neutral; pour the soul into the mission/values passages that are actually true. |
| `ru/pages/contact.md` | Same caveat re: placeholder persona/email. |

### Tier 2 — guides (the Learn section; medium-high register)
`ru/guides/kickstart-playbook.md`, `writing-reviews-that-earn-trust.md`,
`how-this-site-will-make-money.md`, `getting-traffic-seo-and-pinterest.md`,
`launch-checklist.md`

- Keep the founder-guide opening blockquote convention (rephrase its wording in
  voice, keep it a blockquote saying the same thing).
- These are honest internal playbooks made public — her difficulty-first
  honesty and cost-naming fit them perfectly. Keep all numbers, steps,
  checklists, and platform names exactly.

### Tier 3 — light touch
| File | Notes |
| --- | --- |
| `ru/pages/roadmap.md` | Building-in-public candor in the prose lines; checkbox items stay terse and factual. Do **not** tick/untick anything. Update the "Last updated" line only if its prose changes. |
| `ru/products/*.md` (6 files) | ⚠️ AI placeholder reviews slated for deletion (launch checklist). Lowest value — apply a light voice pass only (verdict lines, flaw sections), or skip if effort is better spent elsewhere; say which you chose. Never add experience claims. |

### Tier 4 — near-zero touch
`ru/pages/privacy.md`, `ru/pages/disclosure.md` — legal precision first. At
most one warm human sentence where one already exists. Compliance wording
(affiliate notice, Amazon pre-staged sentence in comments) must remain intact.

### Out of scope — do NOT touch
- Anything under `content/locales/en/` (EN is the factual source of truth).
- `src/locales/ru.ts` (UI chrome labels — short functional strings, no room
  for voice) and `src/lib/astroText.ts` (serious-astrology vocab; hard rule).
- Frontmatter **keys**, slugs/filenames, `date`, `category`, `rating`, `price`,
  `tags`, `image` paths. (`title` and `excerpt` *text* may be rephrased.)
- `content/themes.yaml`, any code, any EN docs.

## Hard constraints (each one is a failure if violated)

1. **Zero fact drift.** Every claim, number, price, step, and caveat must
   survive rephrasing unchanged. Rephrase against the RU file *and* check the
   EN counterpart when meaning is ambiguous.
2. **Truth-first:** no new experience claims, durations, anecdotes, or
   testimonials — the persona file provides voice, never biography-material to
   insert into content.
3. **Glossary:** do-not-translate terms stay English (Roadmap, Pinterest, SEO,
   `site.yaml`, …).
4. **House style limits on her raw register:** no emoji in reviews/legal
   (avoid everywhere), no `!!`/exclamation stacking, no «короче» verbatim —
   see the register-calibration table in persona-context.md.
5. Markdown structure preserved: headings, lists, blockquotes, links, image
   refs, GFM checkboxes.

## Process per file

1. Read the RU file and its EN counterpart.
2. Rephrase paragraph by paragraph; run each through the persona file's
   5-question test.
3. Diff-review your own output for fact drift before moving on.

## Verification & wrap-up

1. `task typecheck && task build` (containerized — never host npm). If Docker
   is down: `open -a OrbStack`, wait ~15s.
2. Serve `dist/` statically and spot-check /, /about, /guides, one guide, one
   review in RU (default locale is `ru`).
3. Update docs per house rule (this plan's Status line → done; note the voice
   convention in `content/locales/README.md` if you add one).
4. **Ask the owner before committing.** Suggested message:
   `content: rephrase all RU content in the author's voice`.

## Definition of done

- [x] Every Tier 1–2 file rereads as *her* (passes the 5-question test).
- [x] Tier 3 handled — roadmap prose touched (checkboxes untouched); products
      given a light voice pass (verdict/flaw lines), stated to the owner below.
- [x] No fact, number, link, term-of-art, or frontmatter datum changed.
- [x] typecheck + build green; RU pages spot-checked in a served build.
- [ ] Owner asked about commit; docs updated (this file + README note done —
      commit still pending owner confirmation).
