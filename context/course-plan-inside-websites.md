# Course plan — "Inside websites like this" (tag: inside-websites)

This course might be ever-evolving so context has to stay for now
**Status:** all 5 chapters shipped 2026-07-05. **English only by owner decision
(2026-07-05)** — no RU counterpart is planned; the epic is deliberately absent
from `ru/site.yaml` `epics:`, so the RU locale never shows the tab. This is a
sanctioned deviation from the blueprint's "both locales ship together" rule.

**What this is.** The engine-room course: how this site's code actually works,
taught top-down — from the URL bar to the lockfile — for developers, UX/UI
designers and ops people who ship around frontends but rarely look inside one.
A **sanctioned 5-chapter deviation** from the 11-chapter blueprint in
[epic-writing-context.md](epic-writing-context.md) (like the founder course):
the territory is exactly the machine's four layers plus a synthesis — Gate =
ch. 1, Path = ch. 2–4, Summit = ch. 5. Everything else follows the blueprint:
Trail block, named concepts, callbacks, one seed per Path chapter, Bridge.
A one-line **engine-room blockquote sits directly under each Trail block**
(truth device, mirroring the founder-note pattern):

> **Engine-room course.** Written to explain this very site's code to our own
> team — every file path named here is real; the site you're reading is the
> lab.

**Audience note.** Primary reader: the owner himself (devops background) and
anyone technical who wants to understand — and later repeat — a modern
frontend stack. Practices are at-the-screen by necessity (blueprint allows it
"where the topic allows").

**Spine artifact:** a **working copy of this site on the reader's machine,
changed at every layer**. Ch. 1 starts it (dev server running + first data
edit); ch. 2 adds a content piece without touching `src/`; ch. 3 adds a
palette; ch. 4 builds and runs the production container; ch. 5 is the exam —
one change shipped end-to-end through every layer, graded against ch. 1's
promise.

## Chapters

| # | Slug | Stage | One-liner |
|---|---|---|---|
| 1 | inside-01-the-whole-machine | The Gate | The two-phase machine, the bundle, the one HTML page, content-is-data; first small win = `task dev` + a live data edit |
| 2 | inside-02-from-markdown-to-bundle | The Path | Build time: the glob vacuum, frontmatter, markdown→HTML, the trust boundary, slugs from filenames, the diagram renderer |
| 3 | inside-03-the-living-page | The Path | Browse time: component tree, client routing, state & hooks, context (i18n), CSS-variable theming |
| 4 | inside-04-shipping-the-box | The Path | Delivery: multi-stage Docker, nginx + SPA fallback, push-is-deploy, the supply-chain discipline, the Taskfile |
| 5 | inside-05-owning-the-stack | The Summit | No new fundamentals — the one-sitting reading order, the decision ledger, where the architecture breaks, rebuild-from-zero, the end-to-end exam |

## Named concepts (callback currency)

- **the two-phase machine** (everything happens at build time or in the
  browser; nothing in between) — ch. 1; reused in 2, 3, 4, 5
- **content is data, code is layout** — ch. 1 (the repo's golden rule); reused
  in 2, 3, 5
- **the bundle** (`dist/` IS the entire site) — ch. 1; reused in 2, 4, 5
- **the one HTML page** (one near-empty `index.html`, JS paints everything) —
  ch. 1; reused in 3, 4, 5
- **the trust boundary** (what code/content we execute without inspection, and
  why the line sits where it sits) — ch. 2 (`dangerouslySetInnerHTML` on
  author-controlled markdown); reused in 4 (deps & `ignore-scripts`)

## Seeds (each answered where named — audit holds)

- ch. 2 → ch. 3: the bundle carries every page and both locales, yet clicking
  a link renders instantly with no network request — chapter 3 shows the
  machinery.
- ch. 3 → ch. 4: a deep link works in production but 404s on a naive static
  server — chapter 4 names the one line of nginx that fixes it.
- ch. 4 → ch. 5: the architecture's blind spot that a business eventually pays
  for (the near-empty first HTML) — chapter 5 weighs it against the
  alternatives and points at the prerendering roadmap item.

## Visuals

Five shared diagram templates (EN-only embeds — the parity check in
content-editing.md will show these referenced by `en` only; that is expected
for this epic): `inside-course-map`, `two-phase-machine`,
`build-pipeline-flow`, `spa-render-flow`, `delivery-pipeline`. Plus GFM
tables: repo map (ch. 1), route table (ch. 3), supply-chain rules (ch. 4),
architecture tradeoffs + reading order (ch. 5).

## Maintenance notes

- Chapter order is `chapter:` frontmatter (1–5); dates keep real authoring
  days.
- Chapter art + epic thumbnail are generated (`task mandalas SET=guides` /
  `SET=epics` — items live in `scripts/generate-mandala.mjs` `SETS`).
- When the stack changes (e.g. the prerendering roadmap item lands), retell
  the affected chapter — ch. 5's "where it breaks" section is the most
  perishable; it currently states the empty-HTML/SEO gap as an open weakness.
- If RU is ever wanted after all, ship all 5 at once (blueprint rules apply)
  and add the `ru/site.yaml` epic entry — the per-slug fallback needs no code.
