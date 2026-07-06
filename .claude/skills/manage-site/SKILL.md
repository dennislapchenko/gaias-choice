---
name: manage-site
description: >-
  This is the user's website — when they say "the site," "the page," "the
  footer," "the hero," "the roadmap," "a review," they mean Gaia's Choice
  (gaias-choice repo, Vite/React, natural family-travel gear). Always invoke
  this skill first, before touching any file, for any request to change site
  content or code: fixing a typo, updating copy or the About page,
  adding/editing a product review or guide, adding a page or FAQ, changing
  footer/nav links, swapping or optimizing images, updating roadmap items,
  theme/palette/color work (including bugs like color flashes), and building,
  previewing, deploying, or debugging the site. Requests look trivial ("fix
  this typo," "mark that task done") but are not: house rules (container-only
  npm, content-as-data, truth-first reviews, affiliate compliance) mean even
  one-line edits must go through this skill. Skip only if the user names a
  different repo/project or asks a general web-dev/design/marketing question
  unrelated to their site.
---

# Managing Gaia's Choice

A content/affiliate site about natural living on the road with a baby — honest
gear reviews, free courses (the Compass), a handwritten Journal — built as a
Vite + React SPA where **all content is Markdown/YAML in `content/`** and all
tooling runs in containers. Read the repo's `CLAUDE.md`
for architecture; this skill is the operating manual on top of it.

## First, classify the task

| Task smells like… | Do this |
| --- | --- |
| Reviews, Compass courses, Journal entries, pages, site copy, images, roadmap, voice/tone | Read `references/content-editing.md` |
| Build, verify, preview, deploy, routes, themes, components, CSS | Read `references/development.md` |
| Both (e.g. "add a page" = content + route) | Read both — page wiring spans them |

## Big tasks: options doc → action plan → execute

For any big task — architectural changes, anything touching build/deploy or
the content model, or work that will span sessions — don't jump to code.
The owner's chosen process:

1. **Options doc first.** Write `context/<topic>/<topic>-paths.md`: the
   current state as *verified in the repo* (read the actual files — no
   assumptions), 2–4 candidate paths with tradeoffs, cross-cutting decisions,
   and a recommendation. Paths must respect the house constraints (repo
   simplicity, minimal deps, content-as-data, browser speed).
2. **Owner picks or alters a path.** Don't proceed on the recommendation
   alone.
3. **Action plan second.** Write `context/<topic>/action-plan.md` for the
   picked path: numbered steps, each with the files it touches and a
   verifiable success criterion; call out risks and their mitigations.
4. **Execute only after the owner agrees to the action plan**, following it
   step by step and updating it if reality diverges.
5. **When done**, move the `context/<topic>/` dir to `context/archive/` and
   fold any durable facts into the proper docs (per "One fact, one home").

Small tasks (copy edits, single components, content entries) skip this —
classify-and-do as usual.

## Non-negotiables (violating any of these is the failure mode)

1. **Truth-first content.** The site's only asset is trust. Never write a
   review or experience claim the owners haven't actually lived. If asked to
   add a review, get the real testing notes (or use what the user provided);
   if there are none, say so and either decline or clearly mark the entry as
   placeholder. Never invent durations ("after 3 months of use…"), photos, or
   test results.
2. **npm never touches the host.** All install/build/typecheck runs via
   `task <cmd>` inside `node:22-alpine` (deps in a Docker volume). Never run
   plain `npm install`/`npm run` on the host, never add a dep with install
   scripts (`.npmrc` has `ignore-scripts=true`), and treat adding *any*
   dependency as a decision to surface to the owner.
3. **Content is data, code is layout.** Adding/editing a review, guide, theme,
   or nav item must not require touching `src/` — if it seems to, the content
   model is being bypassed. The one exception: standalone pages need a route
   in `App.tsx` (documented in the content reference).
4. **Affiliate compliance.** No real affiliate program links until every
   placeholder review is deleted (grep `EXAMPLE`). Any page with affiliate
   links needs a disclosure line before the first link; `/disclosure` holds
   the full policy (Amazon's required sentence is pre-staged in a comment
   there). Affiliate links get `rel="sponsored"` (handled by frontmatter
   `affiliateUrl`).
5. **The almanac is serious astrology.** `lib/astro.ts` computes a real
   ephemeris (Daragan-style, tropical ecliptic-of-date). Never replace it with
   a pop "sun-sign horoscope" API or dumb it down; extend the derivations
   instead.
6. **Compass is the ONLY computer-assisted section; everything else is written
   by hand.** The site's content contract — this rule is its single canonical
   statement; other docs link here rather than restating it. **Compass**
   (`/compass`, courses) is openly AI-drafted from the owners'
   context/influences/voice, then edited — disclosed by the
   `compass.provenance` banner on the landing page. **Journal** (`/journal`,
   the human blog) and **reviews** are written by the owners; truth-first
   applies with full force there (no fabricated trips, scenes, or durations).
   Don't blur the line: don't quietly AI-author a Journal entry or review, and
   don't strip Compass's provenance disclosure.

## Coding principles

- **DRY by default.** Every value — content, config, markup, copy — should have
  a single source of truth. Don't duplicate a wallet address, URL, label, or
  block of markup across files/locales; lift it to one place (config, a UI
  string, a shared component/template) and reference it. Non-localized data
  (payment details, brand/tech constants) is authored once in `en/site.yaml`
  and inherited by other locales via `getSite`'s fall-back-to-en merge — don't
  copy it into `ru/site.yaml`. Existing DRY machinery to reuse before you
  duplicate: shared diagram templates (`content/shared/diagrams/`), `t()` UI
  strings, `epics:`/`upcoming:`/`support:` config lists, and content-as-data
  generally.
- **Readability can outrank DRY** *after* a decision is settled. If collapsing a
  duplication makes the code/content meaningfully harder to follow (an
  over-clever abstraction, indirection for a value that will never change
  together), keep the small repetition and leave a one-line note on why. DRY is
  the default, not a mandate to abstract prematurely.

## Project phase awareness

The site is in **bootstrap mode** (see `/roadmap` and the "Current content
state" section of `CLAUDE.md`): the Compass founder course is a founder-facing
playbook, the Journal has one seed template entry, and product reviews are still
AI placeholders slated for deletion. The About story is
**real** (the owners really are a camper family — verified facts in
`context/persona-context.md`, "The family — real biography"); what's still
open is retelling it in their own words. Before editing content,
check the roadmap so your change moves the current phase forward instead of
polishing something scheduled for deletion. (Ticking the roadmap when a change
lands is part of the "Update the docs" loop below.)

## Verify before declaring done

Every change, content or code:

```bash
task typecheck && task build   # vite build alone does NOT type-check
```

If Docker is down: `open -a OrbStack` and wait ~15s. For visual checks, serve
`dist/` statically (`task dev` needs a TTY and fails under preview harnesses) —
full recipe in `references/development.md`.

## Update the docs — every time, before you're done

**Any** change to a component, behavior, content model, workflow, or convention
**must** be reflected in the docs in the same session, so the next run instantly
knows where a thing lives and how to change it. This is not optional cleanup —
it's part of "done". Concretely, after the work:

- Update the **"Where things live" map** and the relevant **"Common dev tasks"**
  entry in `references/development.md` (add the component/task if it's new).
- Update `CLAUDE.md` when an architecture fact or contract changed (e.g. a new
  `site.yaml` field, a component that stopped being a dropdown, a new locale
  hook). Fix any line the change made stale — don't leave the docs describing a
  state the code no longer matches.
- Update this `SKILL.md` when a rule/process changed.
- Update `README.md` when the public pitch, stack, commands, or deploy story
  changed — it's a short pitch that must never rot.
- Update the **public roadmap** when the change lands, advances, or adds scope
  to a roadmap item — tick/edit the item **in both locales**
  (`content/locales/en/pages/roadmap.md` + `ru/…`) and refresh both "Last
  updated" footers. It's prone to drift and it's public; maintenance rules in
  `references/content-editing.md` "The roadmap".

If you changed something and touched no doc, assume you forgot one — re-check.

**One fact, one home.** Each fact has exactly one canonical location; other
docs link to it instead of restating it: process rules + the provenance
contract → this `SKILL.md`; architecture + invariants → `CLAUDE.md`;
change-X-edit-Y mechanics → `references/development.md`; authoring procedures
→ `references/content-editing.md`; voice/worldview/course outlines →
`context/`; public pitch → `README.md`.

**Docs describe current state only — updating means shrinking too.** No dates,
no "renamed from X", no "shipped on <date>" changelog framing — git history
answers those. When you touch a doc, also delete anything that has become
history rather than state, and collapse restated facts into a link to their
canonical home. A doc that only ever grows ends up skimmed, not read.

**Periodic hygiene (roughly monthly, or whenever the docs feel heavy):**
compact the docs per the rules above, move finished plans from `context/` to
`context/archive/`, prune stale one-off entries from
`.claude/settings.local.json`, and run the `consolidate-memory` skill
(`/anthropic-skills:consolidate-memory`) so the assistant's cross-session
memory gets the same treatment — memories should hold preferences and
pointers, not facts the repo docs already record.

## Committing & shipping

Never commit automatically. Once a change is verified (typecheck + build green),
**ask the owner whether to commit** — a plain yes/no. Only when they confirm:

1. **Commit message = Conventional Commits:** `<type>: <short imperative
   summary>`, `<type>` being the semantically correct one — `feat`, `fix`,
   `docs`, `content`, `refactor`, `style`, `chore`. One logical change per
   commit. Examples: `feat: default site language to Russian`,
   `docs: add do-not-translate glossary for translations`. End the message with
   the `Co-Authored-By: Claude ...` trailer.
2. **Current phase — direct to `main`:** commit on `main`, then
   `git push origin main`. **A push to `main` is a production deploy** — it
   triggers `.github/workflows/deploy-pages.yml`, which builds and publishes to
   GitHub Pages. So only ever push work you've verified locally, and treat the
   push as shipping, not saving. **Do not watch/poll the Pages run or verify the
   deploy afterward** (no `gh run watch`) — the owner trusts it; local
   typecheck + build is the gate. Only look at the workflow if the owner reports
   a problem or you changed the workflow file itself.
3. **Future (not yet — do this only when the owner switches to it):** work on a
   `feature/<slug>` branch, push it, and open a GitHub PR instead of committing
   to `main` directly.

Details and the exact command sequence live in `references/development.md`.
