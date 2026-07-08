# CLAUDE.md

1. Don’t assume. Don’t hide confusion. Surface tradeoffs.
2. Minimum code that solves the problem. Nothing speculative.
3. Touch only what you must. Clean up only your own mess.
4. Define success criteria. Loop until verified.

Guidance for working in this repo. Read this first; it captures decisions that
aren't obvious from the code.

**Doc layout — one fact, one home.** This file holds *architecture and
invariants*. Process rules (truth-first, provenance contract, committing) live
in `.claude/skills/manage-site/SKILL.md`; the course-batch production workflow
in `.claude/skills/write-epic-course/SKILL.md`; change-X-edit-Y mechanics in
`references/development.md`; the Go API + auth + live-edit portal in
`references/backend.md`; authoring procedures in `references/content-editing.md`
(all `references/*` live under `.claude/skills/manage-site/`, not the repo
root); voice/worldview source material in `context/`. **Component/CSS/flow
mechanics belong in a `development.md` row — this file gets at most one
sentence + a pointer.** Docs describe **current state only** — no dates, no
changelog framing (git history answers those); when you update docs, delete
anything that has become history rather than state.

## What this is

**Gaia's Choice** — a content site about **natural, conscious living on the
road with a baby** (framed generally: camper, car, or carry-on — not
RV/van-specific). Three pillars, one contract (everything is lived first):
honest **reviews** of natural, plastic-free, fragrance-free gear; the
**Compass** (free courses on the natural-living skills the owners practice);
and the **Journal** (the handwritten record of the road). It is a
**client-rendered SPA**, not an SSR/SSG site.

- **Stack:** Vite + React 18 + TypeScript, `react-router-dom` (BrowserRouter).
- **Content:** Markdown + YAML in `content/`, bundled at build time. No CMS, no
  runtime content fetching. An **optional** Go API sidecar (`backend/`, off by
  default) adds progressive-enhancement features (see "Backend" below).
- **Serving:** static build via nginx in a container. Live deploy is GitHub
  Pages (push to `main`); Cloud Run remains a supported target.

## Golden rules

1. **Content is data, code is layout.** Adding/editing a review, guide, or page
   must NOT require touching `src/`. If it does, the content model is being
   bypassed — fix the model instead.
2. **npm never runs on the host.** All install/build/lint runs inside a
   throwaway `node:22-alpine` container; deps live in a Docker volume. See
   "Supply chain" below. Don't add a plain `npm install` step to any workflow.
3. **Minimal dependencies.** 6 runtime deps only (listed under "Supply chain").
   Adding one is a real decision — prefer a few lines of code over a new
   package, and never add something with install scripts (`.npmrc` sets
   `ignore-scripts=true`).

## Directory map

```
content/                 # ALL editable content (no code)
  locales/
    README.md            # per-locale layout + do-not-translate glossary +
                         # the en-only inherited site.yaml field list
    en/                  # English — source of truth, always complete
      site.yaml          # name, nav, values, respected, epics, sidebar, support…
      products/*.md      # reviews → /reviews/<filename-without-.md>
      compass/<epic>/*.md# Compass chapters → /compass/<slug> (subfolder is
                         # organizational only, not part of the route)
      journal/*.md       # Journal entries → /journal/<slug> (flat)
      pages/*.md         # standalone pages (about, contact, roadmap, …)
    ru/                  # Russian — falls back to en/ per collection + per slug
  shared/                # diagram templates ({{slot}} tokens, see Compass) +
                         # <kind>-template.<locale>.md blank draft scaffolds
  themes.yaml            # color palettes — not localized
context/                 # authoring context (NOT bundled into the site)
  persona-context.md     # author's voice + the family's REAL biography — read
                         # before writing RU content or any "who we are" copy
  ideology-context.md    # influences by domain (Health / Worldview / Children);
                         # Health governs food claims
  epic-writing-context.md# blueprint for Compass epic courses
  course-plan-*.md       # one outline per course
  <topic>/               # active big-task plan dirs (SKILL.md "Big tasks");
  archive/               # completed plans — not live context
public/images/           # optimized WebP photos + generated mandala SVG art
scripts/generate-mandala.mjs  # mandala art generator (see Images)
src/
  main.tsx               # React root + BrowserRouter + I18nProvider
  App.tsx                # route table
  locales/{en,ru}.ts     # UI chrome strings (nav, buttons) — NOT page content
  lib/                   # content.ts (the core loader), i18n.tsx, theme.ts,
                         # head.tsx (per-route <title>), astro.ts + astroText.ts
                         # (almanac), asset.ts (BASE_PATH), api.ts (FE↔BE
                         # contract), session.tsx (login seam), editMode.tsx +
                         # contentEditor.tsx (live-edit), types.ts
  components/, pages/    # per-component map: development.md "Where things live"
  styles.css             # single hand-written stylesheet (no CSS framework)
backend/                 # optional Go/gin API sidecar; openapi.yaml is THE
                         # endpoint contract (see "Backend")
compose.dev.yaml         # `task dev` stack: web (Vite HMR) + api (air reload)
deploy/                  # live VM stack (api + Caddy) + infra-log.md record
.doco-cd.yml             # doco-cd GitOps for the VM — deferred
Dockerfile               # multi-stage: node build → nginx runtime
nginx/default.conf.template  # $PORT + SPA fallback
Taskfile.yml             # all common commands
```

## How content loading works (`src/lib/content.ts`)

The heart of the site — everything is bundled at **build time**
(`import.meta.glob` over `content/locales/*/…`, raw strings; nothing fetched
at runtime). Frontmatter is parsed with the `yaml` package (browser-safe —
deliberately NOT `gray-matter`, which needs Node's `Buffer`); the body renders
through `marked` (GFM) into `dangerouslySetInnerHTML` — **content is trusted**
(author-controlled); never feed untrusted markdown through it unsanitized.
**The filename (minus `.md`) is the slug / URL** — renaming a file changes its
URL; nothing hardcodes slugs. Collections sort by `date` descending. Custom
`marked` renderers stamp heading anchor ids (Cyrillic-transliterated, feeds
the entry TOC) and render <code>```diagram</code> fenced blocks (mechanics:
development.md "Entry detail TOC" + "Guide tables & SVG diagrams" rows;
authoring: `content-editing.md`).

## The content sections

**Reviews** (`/reviews`, `products/*.md`) — frontmatter `title`, `category`
(filter chip), `scores` (the **Gaia Score**), optional `price`/`boughtAt`
(where we got it — free text)/`affiliateUrl` (rendered
`rel=sponsored`)/`image`/`tags`/`state`, `excerpt`, `date`. Every review
follows the universal six-section body structure whose canonical source is
`content/shared/review-template.<locale>.md`. Detail layout (header, reading
column, sticky facts rail of panel cards, buy CTA): development.md "Cards" row.

**Gaia Score (review rating).** Not a single star: `site.yaml`
`ratingCriteria` defines ONE shared criteria list (localized; names currently
**provisional** — owner to finalize), and each review's `scores:` is an array
of 0–5 numbers **aligned to `items` by index**. Adding/renaming a criterion is
a one-line `site.yaml` edit that relabels every review at once —
content-as-data, no per-file churn. Rendering (`GaiaScore.tsx` bars,
`ProductCard` average): development.md "Cards" row.

**Post states (reviews + Journal):** `state: active` (absent = active) or
`state: upcoming`. An upcoming post is a **real content file** that isn't
finished: out of the main listing, title-only in the "in the works" rail, but
still previewable at its real URL (readers see an "In the works" tag; an
admin/editor gets inline edit + state-flip controls). Flipping the frontmatter
to active moves it into the main spot — the file never moves. New drafts
queued via the editor's ＋ button start `upcoming`. Compass chapters and pages
ignore `state`. Mechanics (rail merge rules, the ＋ button, live-edit):
development.md "Upcoming" + "Live-edit" rows.

**Compass** (`/compass`, `compass/<epic>/*.md`) — the site's **courses**
section (user-facing "Compass" / «Путь») and the one **openly
computer-assisted** section, disclosed by the `compass.provenance` banner (the
provenance contract is SKILL.md non-negotiable #6).

- **A chapter's FIRST tag is its epic** (course); the subfolder is filesystem
  tidiness only — slug = filename. Epic display metadata lives in `site.yaml`
  `epics:`; the first entry is the default tab.
- Courses are **5 or 11 chapters** (owner rule); optional `chapter: N`
  frontmatter orders them. Existing epics, all complete: `founder-guide` (5),
  `herbalism` (11), `homeopathy` (11), `trophology` (5) — en+ru — and
  `inside-websites` (5, **English-only by owner decision** — absent from
  `ru/site.yaml`; its EN-only diagrams are expected parity-check asymmetries).
  Outlines: `context/course-plan-*.md`; blueprint:
  `context/epic-writing-context.md`.
- **EntryDetail** is the shared detail page for Compass chapters *and* Journal
  entries, with a page-local TOC from `h2`/`h3` headings (3+ required) —
  development.md "Entry detail TOC" row.
- **Diagrams:** geometry authored once per diagram as a shared template
  (`content/shared/diagrams/<name>.svg`, `{{slot}}` tokens); each locale's
  markdown fills the slots via a <code>```diagram &lt;name&gt;</code> fenced
  block. Renderer mechanics: development.md "Guide tables & SVG diagrams" row;
  authoring rules + parity checks: `content-editing.md` "Visuals inside guides".

**Journal** (`/journal`, `journal/*.md`, flat) — the **human-written,
date-ordered blog**, the honest counterpart to the Compass (provenance
contract: SKILL.md #6). Frontmatter `title`, `excerpt`, `date`, optional
`tags`/`image`/`state`; no per-entry wiring. Shares the Reviews page shell
(year chips, upcoming rail); entries open through `EntryDetail`; the landing
page surfaces the latest three. The seed entry
(`journal/driving-with-a-toddler.md`) is an explicit fill-in template, not an
invented trip.

**Pages** (`pages/*.md`) — the one content type needing code wiring: a route
in `App.tsx` (`<MarkdownPage slug="x" />`). Exception: `/support` is a
dedicated `pages/Support.tsx` rendering the non-localized `support:` config
block from `en/site.yaml`; only its intro prose is `pages/support.md`.

## Images

Two paths (full mechanics: `content-editing.md` "Images"): **real photos**
drop into `public/images/` and get optimized to WebP by `task images`
(containerized ImageMagick; **removes the originals**, does NOT rewrite
content references); **mandala SVG art** — the generated radial-symmetry
images guide chapters and reviews use instead of stock photos — comes from
`scripts/generate-mandala.mjs` via `task mandalas SET=<name>` (development.md
"Mandala SVG art" row). Content references images by absolute path
(`/images/x.webp`). Real product photos replace review mandalas when real
reviews ship.

## Styling & color

Single stylesheet `src/styles.css`, CSS variables in `:root`. Design is
intentionally **round** — `--radius: 22px` drives cards, hero, bands, images;
pill elements use `999px`. `--sage` is the **primary accent**, `--clay` a warm
accent, `--mint`/`--peach`/`--lilac` three pastel **slots** (a palette can put
any hue in them), `--sand` the page background, `--on-accent` the text color
placed on accent surfaces. Detail/prose images cap at 440px tall on desktop
only; phones keep full width.

### Theming / palette switcher

Palettes are **data, not code** — one entry per palette in
`content/themes.yaml` (`tag` = stable id, `label`, `colors{…}`); `lib/theme.ts`
maps the keys to CSS vars, persists the pick to `localStorage['gc-theme']`,
and runs `initTheme()` before React renders (no flash). Light palettes set 10
slots; dark palettes add `ink`/`muted`/`white` to flip text/cards dark. A
first-time visitor gets a palette by OS preference: **exactly one** entry has
`default: true` (light) and one `defaultDark: true` — currently **citrus** and
**midnight**; an explicit pick wins from then on. **Adding a palette = append
to themes.yaml, no code change** (currently 13: 7 light + 6 dark). The `:root`
values in `styles.css` are the pre-JS fallback — keep in sync with the light
default. Dark-slot mechanics, the runtime tint vars, and per-palette WCAG
notes: development.md "New palette" task.

### Language switching / i18n

Two kinds of translatable text, separate homes: **page content** (data,
`content/locales/<lng>/` — see `content/locales/README.md`) and **UI chrome
strings** (code, `src/locales/<lng>.ts`, a flat dictionary via `t()` from
`useI18n()`). `SUPPORTED_LOCALES` is `['ru', 'en']`, `DEFAULT_LOCALE` is
`'ru'`; the choice persists to `localStorage['gc-lang']`; `initI18n()` runs
before React renders. Every content getter **falls back to `en`** — per
collection, then per slug — so the site never breaks mid-translation;
`getSite` additionally **shallow-merges `en` as a base**, so locale-identical
fields (e.g. the `support:` payment block) are authored once in `en/site.yaml`
(canonical field list: `content/locales/README.md`). The almanac's generated
wording lives in `src/lib/astroText.ts` (one `Vocab` per locale), not in
`t()`. **Russian is fully translated** — UI strings and all content. **Do NOT
calque proper nouns / terms-of-art** (Roadmap stays `Roadmap`) — the glossary
is in `content/locales/README.md`; read it before translating. Adding a
locale: checklist in development.md "Common dev tasks".

## Sidebar & celestial almanac

`Layout.tsx` wraps every page in a two-column shell: a left `Sidebar` of
collapsible panels + the routed content (≤900px the rail rides above the
content as a tab-row). Panel types live in `Sidebar.tsx`'s `PANELS` registry;
**composition + order are content-driven** (`site.yaml` `sidebar:` list). The
`respected` panel mirrors `context/ideology-context.md` (same people, same
order — update both together; names are never translated). Wiring +
responsive details: development.md "Sidebar" row.

The almanac widget (`AstroCalendar.tsx`) is a month grid where event days get
astrological glyphs; hover/focus/click updates a detail panel below the grid
(a panel, not a tooltip — tooltips clip in the ~300px rail).

### The ephemeris engine (`lib/astro.ts`) — serious astrology, not "fun"

**Real, astronomically-grounded astrology** (Konstantin Daragan worldview).
Positions come from **`astronomy-engine`** (MIT, zero deps), computed
**entirely in the browser** — no API, no key, no network — from geocentric,
apparent, **tropical, ecliptic-of-date** longitudes. It derives moon phases,
sign ingresses (incl. the fast Moon), void-of-course Moon, retrograde
stations, major aspects, and eclipses; `eventsForMonth(y, m, locale)` returns
memoised `AstroEvent[]`. Times show in the **viewer's local timezone**; the
engine is **timezone-aware but not location-aware** (no eclipse visibility,
rise/set, houses, planetary hours). All wording lives in `lib/astroText.ts`;
`astro.ts` is math + glyphs only.

**Do NOT replace this with a shallow "sun-sign horoscope" API** — that's
exactly the hipster-fake astrology the owner rejected. Want more
features/accuracy? Extend the derivations in `astro.ts` — add a generator that
pushes `Raw` events (location-dependent ones like lunar days / planetary hours
would need the viewer's coordinates).

## Commands (Taskfile)

`task` lists everything. **All npm/Go tooling runs in containers** (deps in
the `gaias-choice-node-modules` / `gaias-choice-go-cache` volumes) — never
host npm. `task typecheck` is separate from `task build` (Vite build does NOT
type-check). The full command table — FE, the `be:*` backend tasks, deploy,
`clean` — is in `references/development.md` "Commands".

## Container & deploy

Multi-stage Dockerfile: `node:22-alpine` builds, `nginx:1.27-alpine` serves
`dist/` on `$PORT` (default 8080; Cloud Run injects it). **SPA fallback:**
unknown paths return `index.html` so client routing works (nginx template +
asset-404 nuances: development.md gotchas). **Live deploy is GitHub Pages:**
every push to `main` triggers `.github/workflows/deploy-pages.yml`
(`BASE_PATH` drives the Vite base). Cloud Run (`task deploy`) remains
available but is not the current default. Commit/push rules: SKILL.md
"Committing & shipping".

## Backend (optional Go/gin API sidecar)

`backend/` is a **static-first progressive enhancement**: a Go + gin JSON API
(port 8787, routes under `/api`) adding login, the in-browser live-edit
portal, and LLM enrich/translate. **Invariant: the static site works
identically with the backend absent** — BE-powered UI renders only when the
API answers; if the VM is down the live site silently degrades to the static
baseline. It runs on a Hetzner VM behind Caddy TLS
(`gaias-choice.gardenofatlantis.com`); the live Pages build is wired to it via
`VITE_API_URL`. Full architecture (contract-first OpenAPI, auth, the content
seam, storage, deploy, `be:*` tasks): **`references/backend.md`** — loaded
only for backend work. The FE↔BE contract is `src/lib/api.ts`; the session
seam `src/lib/session.tsx`; edit mode `src/lib/editMode.tsx` +
`src/lib/contentEditor.tsx`.

## Supply chain (the reason for the container dance)

The owner wants the npm surface kept off the host and minimal.

- `.npmrc` → `ignore-scripts=true`: lifecycle scripts never run. The chosen
  deps don't need them; keep it that way.
- All npm work runs in `node:22-alpine`; `node_modules` lives in a named
  Docker volume. A host `node_modules/` is an empty mount stub — safe to delete.
- `package-lock.json` pins the full tree; `task audit` must stay at 0 vulns.
- Runtime deps (6): `react`, `react-dom`, `react-router-dom`, `marked`,
  `yaml`, `astronomy-engine` — all browser-safe, zero/low transitive deps, no
  install scripts.
- **Backend (Go) follows the same stance:** containerized toolchain, `go.sum`
  pins + `go mod verify`, five direct deps, hand-written
  CORS/migrations/rate-limiter, `air`/oapi-codegen run-not-imported. Full
  list + rationale: `references/backend.md` "Toolchain".

## Dev gotchas

- **Type-checking is separate from building** — `vite build` happily ships
  type errors; always run `task typecheck` too.
- **DEBUG gate:** `src/lib/debug.ts` exports `DEBUG` — wrap any dev-only
  chrome in `DEBUG && …`. On in `vite dev`, forceable with `VITE_DEBUG`, OFF
  in the prod Pages build. It's a Vite env gate, **not** a `site.yaml` field
  (`site.yaml` ships to the visitor bundle). The backend's DEBUG is a separate
  env — `references/backend.md` "Toolchain".
- **Verifying visually:** `task build`, then serve `dist/` with any static
  server — deep links only resolve via the nginx fallback, so load `/` and
  navigate by clicking.
- More (ngrok allowedHosts, YAML quoting traps, BASE_PATH, TTY, nginx
  envsubst): "Known gotchas" in `references/development.md`.

## Current content state (bootstrap mode)

The owners are first-time site builders learning the affiliate-content
business in public. Keep this section current *and short* — the phase, not
the history:

- **Compass:** all five courses complete. The founder guides are internal
  playbooks deliberately published as a course — don't "fix" them into
  consumer content; retelling them from lived experience is a roadmap
  milestone. Open launch-checklist item: label each reader course's
  provenance at its top.
- **Journal:** one seed entry (an explicit fill-in template) + a couple of
  `state: upcoming` stubs queued.
- **Reviews:** the six *active* `products/*` are **AI placeholder reviews**
  with fake affiliate URLs (`EXAMPLE…`) — slated for deletion/replacement.
  **Never add a real affiliate program while these exist.** The real pipeline
  is the `state: upcoming` stubs feeding the "in the works" rail.
- **Pages:** `/roadmap` is public building-in-public — keep it updated when
  milestones land. `/disclosure` + `/privacy` are compliance groundwork,
  required before joining any affiliate program.
- **The camper family is real** — Lidia & Denis, baby born Jan 2025, two
  Basenjis, a self-built campervan; verified facts in
  `context/persona-context.md`. **Don't extrapolate beyond that file** (no
  invented durations, routes, or gear experiences). `contact.md` email +
  `site.yaml` socials are still placeholders.

## Status & shipping

Git repo on `main`, remote `origin` (GitHub). A push to `main` is a
production deploy. **Whether the assistant commits/pushes automatically or
asks first is gated by `.claude/behavior.yaml`** (`AUTO_COMMIT_PUSH`,
`COMMIT_PUSH_FOLLOWING`). The full procedure (Conventional Commits, flag
semantics, `be:deploy` follow-through, future PR flow) is SKILL.md
"Committing & shipping".
