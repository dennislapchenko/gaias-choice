# CLAUDE.md

1. Don’t assume. Don’t hide confusion. Surface tradeoffs.
2. Minimum code that solves the problem. Nothing speculative.
3. Touch only what you must. Clean up only your own mess.
4. Define success criteria. Loop until verified.

Guidance for working in this repo. Read this first; it captures decisions that
aren't obvious from the code.

**Doc layout — one fact, one home.** This file holds *architecture and
invariants*. Process rules (truth-first, provenance contract, committing) live
in `.claude/skills/manage-site/SKILL.md`; the course-batch production
workflow in `.claude/skills/write-epic-course/SKILL.md`; change-X-edit-Y
mechanics in `references/development.md`; authoring procedures in
`references/content-editing.md`; voice/worldview source material in `context/`.
Docs describe **current state only** — no dates, no "renamed from", no
changelog framing (git history answers those). When you update docs, fix stale
lines *and* delete anything that has become history rather than state.

## What this is

**Gaia's Choice** — a content site about **natural, conscious living on the
road with a baby** (framed generally: camper, car, or carry-on — not
RV/van-specific). Three pillars, one contract (everything is lived first):
honest **reviews** of natural, plastic-free, fragrance-free gear; the
**Compass** (free courses on the natural-living skills the owners practice);
and the **Journal** (the handwritten record of the road, and of the
practices worth passing on). It is a
**client-rendered SPA**, not an SSR/SSG site.

- **Stack:** Vite + React 18 + TypeScript, `react-router-dom` (BrowserRouter).
- **Content:** authored as Markdown + YAML in `content/`, bundled at build time.
  No CMS, no runtime data fetching for content. An **optional** Go API sidecar
  (`backend/`, off by default) adds progressive-enhancement features; the
  static site works identically without it (see "Backend" below).
- **Serving:** static build served by nginx in a container. Live deploy is
  GitHub Pages (push to `main`); Cloud Run remains a supported target.

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
    README.md            # per-locale layout + the do-not-translate glossary
    en/                   # English — source of truth, always complete
      site.yaml           # name, tagline, description, bio, mission, nav, values,
                          # respected, heroImage, social, url, epics, sidebar, support
                          # (locale-identical fields live in en/ ONLY, inherited via
                          # getSite's shallow merge — the list is in locales/README.md)
      products/*.md       # reviews  → /reviews/<filename-without-.md>
      compass/<epic>/*.md # Compass course chapters, per-epic subfolders → /compass/<slug>
                          # (subfolder is organizational only, not part of the route)
      journal/*.md        # Journal entries (human-written blog) → /journal/<slug> (flat)
      pages/*.md          # standalone pages (about, contact, roadmap, disclosure,
                          # privacy, support)
    ru/                   # Russian — falls back to en/ per collection and per slug
  shared/
    diagrams/*.svg       # diagram templates ({{slot}} tokens) — geometry authored once,
                         # reused by every locale (see Compass below)
    <kind>-template.<locale>.md   # blank scaffolds behind the "Contribute!" copy
                                  # buttons (journal- on /journal, review- on /reviews)
  themes.yaml            # color palettes (tag + label + default + colors) — not localized
context/                 # authoring context (NOT bundled into the site)
  persona-context.md     # the author's voice + the family's REAL biography — read before
                         # writing/rephrasing RU content or any "who we are" copy
  ideology-context.md    # influences by domain: Health (Chek, Asprey, Reid) / Worldview
                         # (Buhner, Daragan, Ralston) / Children (Steiner, Swan);
                         # Health governs food claims
  epic-writing-context.md  # blueprint for Compass epic courses (curriculum, Thread
                           # weave, chapter anatomy)
  course-plan-*.md       # one outline per course (chapters, concepts, seeds, reuse maps)
  <topic>/               # active big-task plan dirs (e.g. seo/) — options doc +
                         # action plan, per SKILL.md "Big tasks"; archived when done
  archive/               # completed plans, kept for reference only — not live context
public/
  images/*.webp, *.svg   # optimized photos + generated mandala art (see Images)
  favicon.svg
scripts/
  generate-mandala.mjs   # generates mandala SVG art (see Images)
src/
  main.tsx               # React root + BrowserRouter + I18nProvider
  App.tsx                # route table
  locales/                # UI chrome strings (nav, buttons, labels) — NOT page content
    en.ts                 # source of truth for UI strings
    ru.ts                 # Russian UI strings (fully translated)
  lib/
    content.ts           # loads + parses all locale content at build time (the core)
    i18n.tsx             # locale state, persistence, t() translate function
    theme.ts             # applies/persists color palettes (CSS var overrides)
    head.tsx             # per-route <title> + meta description (client-side interim
                         # until prerendering; usePageHead hook + PageHead component)
    astro.ts             # in-browser ephemeris → celestial events (astronomy-engine)
    astroText.ts         # all almanac wording, one Vocab per locale
    asset.ts             # withBase/withBaseHtml for BASE_PATH-aware asset URLs
    api.ts               # the whole FE↔BE contract: fetch wrappers, useApi, content types
    session.tsx          # THE login session seam: token, /auth/me validation,
                         # login/register/signOut, hosts the LoginDialog
    editMode.tsx         # edit-mode gate — thin session consumer (#edit shortcut)
    contentEditor.tsx    # git-backed editor popup (field edits + draft files)
    types.ts             # SiteConfig, Product, Guide, Page, Theme, AstroEvent, EditRef
  components/            # Layout, Sidebar, AstroCalendar, ThemeSwitcher,
                         # LanguageSwitcher, UserButton, LoginDialog, ProductCard,
                         # CompassCard, CompassRow, JournalRow, Upcoming, Markdown,
                         # Rating, TableOfContents, CopyButton, EditButton, BackendBadge
  pages/                 # Home, Reviews, ReviewDetail, Compass, Journal,
                         # EntryDetail (shared Compass+Journal detail w/ TOC),
                         # MarkdownPage (about/contact/etc), Support,
                         # Account (the campfire), NotFound
  styles.css             # single hand-written stylesheet (no CSS framework)
backend/                 # optional Go/gin API sidecar (see "Backend" below)
  openapi.yaml           # THE endpoint contract — endpoints are born here (task be:gen)
  main.go, internal/{config,store,auth,content,httpapi}, Dockerfile, go.mod
compose.dev.yaml         # `task dev` stack: web (Vite HMR) + api (air hot reload)
deploy/                  # live VM deploy stack: compose.yaml (api+Caddy), Caddyfile,
                         # README (target), infra-log.md (provisioning record)
.doco-cd.yml             # doco-cd (GitOps) config for the VM — deferred, reconciles deploy/
Dockerfile               # multi-stage: node build -> nginx runtime (static site)
nginx/default.conf.template  # $PORT + SPA fallback (envsubst at container boot)
Taskfile.yml             # all common commands
```

## How content loading works (`src/lib/content.ts`)

This is the heart of the site. At **build time**:

- `import.meta.glob('../../content/locales/*/<kind>/*.md', { query: '?raw', eager: true })`
  pulls every markdown file, in every locale, in as a raw string. Nothing is
  fetched at runtime. See "Language switching / i18n" below for how the locale
  segment is resolved and falls back to English.
- `parseFrontmatter()` splits the leading `---` YAML block from the body using a
  regex, and parses the YAML with the `yaml` package (browser-safe — this is why
  we do NOT use `gray-matter`, which needs Node's `Buffer`).
- The body is rendered to HTML with `marked` (GFM on) and injected via
  `dangerouslySetInnerHTML` in `components/Markdown.tsx`. **Content is trusted**
  (author-controlled), so this is intentional — do not accept untrusted markdown
  here without sanitizing.
- **The filename (minus `.md`) is the slug / URL.** Renaming a file changes its
  URL. Nothing hardcodes slugs; they're derived from paths.
- Collections are sorted by `date` descending.
- A custom `marked` heading renderer (`headingIdRenderer`) stamps anchor ids,
  slugified with Cyrillic transliteration, so RU headings get stable readable
  anchors (feeds the entry TOC).
- A `marked` `renderer.code` override (`renderDiagram`) turns
  <code>```diagram &lt;name&gt;</code> fenced blocks into shared-template SVG
  figures (see "Compass" below).

Authoring procedures (frontmatter schemas, voice rules, step-by-steps) live in
`references/content-editing.md` — this section is only the loading mechanics.

## The content sections

**Reviews** (`/reviews`, `products/*.md`) — frontmatter `title`, `category`
(filter chip), `rating` 0–5, optional `price`/`affiliateUrl` (rendered
`rel=sponsored`)/`image`/`tags`/`state`, `excerpt`, `date`. Every review
follows the universal six-section body structure whose canonical source is
`content/shared/review-template.<locale>.md` — the scaffold the "Contribute!"
button on `/reviews` copies to the clipboard.

**Post states (reviews + Journal):** a post is `state: active` (absent =
active) or `state: upcoming`. An upcoming post is a real content file that
isn't finished: it drops out of the main listing and shows **title-only** in
the "in the works" rail (shared `Upcoming` component; `getUpcomingProducts`/
`getUpcomingJournal` in `content.ts` merge en + locale **by slug**, locale
wins, so en-only review stubs appear on every locale's rail). Flipping the
frontmatter to active moves it into the main spot — the file never moves.
Detail getters don't filter by state, so a WIP post is previewable at its real
URL (detail pages show an "In the works" tag). The contribute templates start
with `state: upcoming`, so drafts arrive queued, not live. Compass chapters
and pages ignore `state`.

**Compass** (`/compass`, `compass/<epic>/*.md`) — the site's **courses**
section (user-facing "Compass" / «Путь») and the one **openly
computer-assisted** section, disclosed by the `compass.provenance` banner
(the full provenance contract is SKILL.md non-negotiable #6). Mechanics:

- **A chapter's FIRST tag is its epic** (course). The `<epic>` subfolder is
  filesystem tidiness only — `content.ts` globs `compass/**/*.md`, slug =
  filename. Epic display metadata (title, thumbnail, blurb) lives in
  `site.yaml` `epics:`; the first entry is the default tab.
- Courses are **5 or 11 chapters** (owner rule). Optional `chapter: N`
  frontmatter orders chapters ascending within an epic (un-chaptered entries
  keep date-desc). Existing epics: `founder-guide` (5, complete — the founder
  playbooks as the course «Честный сайт с нуля»), `herbalism` (11, complete,
  en+ru), `homeopathy` (11, chapters 1–3 live, rest pending — a mid-write
  course's last "next" link stays text-only until the next chapter ships),
  `trophology` (5, complete, en+ru), `inside-websites` (5, complete, **English-only by owner
  decision** — absent from `ru/site.yaml`, its diagrams are expected EN-only
  parity-check asymmetries). Outlines live in `context/course-plan-*.md`; the
  authoring blueprint is `context/epic-writing-context.md`.
- **EntryDetail** is the shared detail page for Compass chapters *and* Journal
  entries (`kind` prop picks getter/back-link/tag; chapter label shows for
  Compass only). It renders a page-local table of contents from `h2`/`h3`
  headings (3+ required) — sticky right column on desktop, `<details open>` on
  mobile. Layout/grid details: the TOC row in `references/development.md`.
- **Diagrams:** geometry is authored once per diagram as a shared template
  (`content/shared/diagrams/<name>.svg` with `{{slot}}` tokens); each locale's
  markdown embeds it via a <code>```diagram &lt;name&gt;</code> fenced block
  whose YAML fills the slots. The renderer HTML-escapes values, uniquifies SVG
  ids per instance, wraps in `<figure class="diagram">` + `<figcaption>`, and
  renders a visible `⚠` figcaption instead of throwing (a throw would blank
  the SPA). Diagrams use palette CSS variables so they re-theme. Authoring
  rules, overflow audit, and parity checks: `references/content-editing.md`
  "Visuals inside guides".

**Journal** (`/journal`, `journal/*.md`, flat) — the **human-written,
date-ordered blog**, the honest counterpart to the Compass (provenance
contract: SKILL.md #6). Frontmatter `title`, `excerpt`, `date`, optional
`tags`/`image`/`state` (see "Post states" above — upcoming entries show
title-only in the "in the works" rail; idea titles are localized by giving the
ru stub the same slug); no per-entry wiring. The listing page shares the
Reviews shell (same layout, year chips where Reviews has category chips via
`?year=`); entries list as plain text rows and open through
`EntryDetail`. A "Contribute!" button on `/journal`
copies `content/shared/journal-template.<locale>.md`. The landing page
surfaces it too: a hero "Read the Journal" button and a "Fresh from the
Journal" section (latest 3 rows) in `Home.tsx`. The seed
entry (`journal/driving-with-a-toddler.md`) is an explicit fill-in template,
not an invented trip.

**Pages** (`pages/*.md`) — the one content type needing code wiring: a route in
`App.tsx` (`<MarkdownPage slug="x" />`). The `support` page is the exception —
a dedicated `pages/Support.tsx` component rendering the non-localized
`support:` config block (Stripe link, PayPal handle, crypto wallets) from
`en/site.yaml`; only its intro prose is `pages/support.md`.

## Images

Source images are large PNG/JPG. They are optimized to resized WebP and committed
under `public/images/`. Referenced from content by absolute path (`/images/x.webp`).

- **Optimize:** drop raster files into `public/images/` and run `task images`.
  It runs ImageMagick in a container, converts PNG/JPG → WebP (shrink-only cap
  at 1400px, quality 80), and **removes the originals**. It does NOT rewrite
  content references — update frontmatter `image:` paths by hand afterward.
  Typical result: ~90% smaller than source PNGs.
- **Mandala SVG art** — guide chapters and product reviews use a
  radial-symmetry "mandala" (rotated `<use>` petal motif + a bespoke central
  icon per topic) instead of stock photos, matching the site's
  cosmic/sacred-geometry look. `scripts/generate-mandala.mjs` generates the
  shared frame from config; only the center icon per item is hand-drawn markup
  in the script's `SETS` config (one named set per content type: `guides`,
  `epics`, `reviews`). Run `task mandalas SET=<name>`. The original 11
  homeopathy/herbalism/founder chapter SVGs predate the generator and are
  hand-authored one-offs. Vector — no `task images` step. Real product photos
  (owners' hands in frame) replace review mandalas per the launch checklist
  when they exist.

## Styling & color

Single stylesheet `src/styles.css`, CSS variables in `:root`. Design is
intentionally **round** — `--radius: 22px` drives cards, hero, bands, and images;
pill elements (buttons, nav, chips, tags) use `999px`.

Color is driven by CSS variables. `--sage` is the **primary accent** (buttons,
nav-active, mission band, eyebrow via `--sage-dark`); `--clay` is a warm accent
(price, rating stars); `--mint` / `--peach` / `--lilac` are **three pastel slots**
(the variable names are just slots — a palette can put any hue in them). They
appear in: the hero gradient, the cycling `.value` cards (`nth-child(3n…)`), and
`.tag` chips. `--sand` is the page background.

Detail/prose images are capped to 440px tall and centered **only on desktop**
(`@media (min-width: 700px)`); phones keep the full-width look.

### Theming / palette switcher

Palettes are **data, not code** — defined in `content/themes.yaml`, one entry per
palette:

```yaml
- tag: meadow        # stable id: persisted to localStorage + shown in the switcher
  label: Meadow      # human-facing name
  default: true      # the palette used when nothing is stored (exactly one)
  colors: { sage, sageDark, onAccent, clay, sand, sand2, line, mint, peach, lilac }
```

`onAccent` is the text/icon color placed **on** the accent (`--sage`) — primary
buttons, active nav pill, mission band, active filter chip (CSS var `--on-accent`).
Pick per palette: white for deep accents, a dark ink for light ones, whichever
gives better contrast. Meadow/Lagoon/Sunset/Grape clear WCAG AA (≥4.5:1);
Bubblegum/Periwinkle/Citrus land ~3.95–4.4 (AA-large, fine for buttons/large text).
Bright mid-tone accents (esp. Citrus orange) can't reach AA-small without going
muddy — nudge the accent hue darker if you need strict AA-small there.

- `src/lib/theme.ts` maps each `colors` key to its CSS variable and sets them
  inline on `document.documentElement`, plus `data-theme="<tag>"`. It reads/writes
  the choice under `localStorage['gc-theme']`.
- `initTheme()` runs in `main.tsx` **before** React renders, so the saved palette
  is applied without a flash.
- `components/ThemeSwitcher.tsx` (in the header) lists every palette with
  swatches and its **label only** (the `tag` id is not surfaced); a ✓ marks the
  active one.
- **To add a palette:** append an entry to `themes.yaml` — no code change. There
  are currently 7 (meadow, bubblegum, citrus, periwinkle, lagoon, sunset, grape).
- **To make one default:** set `default: true` on it (and remove it from the
  others). The current default is **periwinkle**. The `:root` values in
  `styles.css` are the pre-JS fallback — keep them in sync with whichever
  palette is `default` if you care about the first-paint frame.

### Language switching / i18n

Two kinds of translatable text, kept in separate places so it's always obvious
where a given string lives:

- **Page content** (reviews, guides, pages, `site.yaml`) — data, under
  `content/locales/<lng>/`. See `content/locales/README.md`.
- **UI chrome strings** (nav labels, buttons, aria-labels — anything hardcoded
  in `src/` rather than authored content) — code, under `src/locales/<lng>.ts`,
  a flat `Record<string, string>` keyed like `'reviews.title'`. Looked up
  through `t()` from `useI18n()`.

`SUPPORTED_LOCALES` in `src/lib/i18n.tsx` is `['ru', 'en']` — Russian listed
first (the order the switcher shows), and `DEFAULT_LOCALE` is `'ru'`.
The choice persists to `localStorage['gc-lang']`; `initI18n()` runs in
`main.tsx` before React renders to set `<html lang>` early, mirroring
`initTheme()`. `I18nProvider` wraps the app and exposes `{ locale, setLocale, t }`
via `useI18n()`.

- `src/lib/content.ts` loads every locale's content via a wildcarded
  `import.meta.glob('../../content/locales/*/...')` and groups it by locale.
  Each getter (`getSite`, `getProducts`, `getProduct`, etc.) takes the current
  `Locale` and **falls back to `en`** — first per-collection (if `ru/` has no
  products at all yet), then per-slug (if only some `ru` products exist). The
  site never breaks or shows blank content mid-translation. `getSite`
  additionally **shallow-merges `en` as a base** (`{ ...en, ...localized }`), so
  a locale can omit any non-localized field (e.g. the `support:` payment block)
  and inherit it from English — author such config once, in `en/site.yaml`.
- `components/LanguageSwitcher.tsx` (in the header, next to `ThemeSwitcher`)
  is **not** a dropdown: a single flag-emoji button that **cycles to the next
  locale on click**, previewing the next locale's flag on hover
  (`LOCALE_FLAGS` in `i18n.tsx`).
- `components/AstroCalendar.tsx` gets month/weekday names + the panel date from
  `Intl.DateTimeFormat(locale, ...)` — new locales get correct calendar names
  for free.
- The almanac's **generated event text** (titles, blurbs, planet/sign/aspect
  names) is *not* in the `t()` dictionary — it lives in `src/lib/astroText.ts`,
  one `Vocab` per locale, consumed by `eventsForMonth(year, month, locale)`. A
  new locale needs a `Vocab` entry there or the almanac falls back to English.
- **Adding a locale:** add its code to `SUPPORTED_LOCALES` + `LOCALE_LABELS` +
  `LOCALE_FLAGS` (all in `i18n.tsx`), add `src/locales/<lng>.ts` with every key
  from `en.ts`, add a `Vocab` in `src/lib/astroText.ts` (bodies, sign case forms,
  aspects, tones), and start dropping files into `content/locales/<lng>/`.
- **Russian (`ru`) is fully translated** — UI strings and all content.
- **Do NOT calque proper nouns / terms-of-art when translating** (Roadmap stays
  `Roadmap`). The full do-not-translate glossary and reasoning live in
  `content/locales/README.md` — read it before adding a locale or translating
  new content.

## Sidebar & celestial almanac

`components/Layout.tsx` wraps every page in a two-column shell
(`.layout-grid`): a left `Sidebar` + the routed content. On desktop the sidebar
is a sticky vertical stack of **collapsible panels**; on phones
(`@media (max-width: 900px)`) it rides **above** the content and renders as a
`SidebarMobile` tab-row (one open at a time). `Sidebar.tsx`'s `PANELS` registry
defines the panel types (`about`, `missionValues`, `respected`, `almanac`); the
composition + order are content-driven (`site.yaml` `sidebar:` list). The
`respected` panel shows the teachers behind the worldview from `site.yaml`'s
`respected:` list — surname chips over one detail card that links out to the
person's `url:`; a display-layer mirror of `context/ideology-context.md`
(same people, same order; adding an influence means updating both; names keep
their original spelling in every locale). Wiring
details and the `/support` auto-open tie-in: the Sidebar row in
`references/development.md`.

The almanac widget is `AstroCalendar.tsx`: a month grid where days with
celestial events are marked with astrological glyphs; hovering/focusing/clicking
a marked day updates a detail panel below the grid (a panel, not a tooltip —
tooltips clip in the ~300px rail). Defaults to the current month and today.

### The ephemeris engine (`lib/astro.ts`) — serious astrology, not "fun"

This is **real, astronomically-grounded astrology** (Konstantin Daragan
worldview). Positions come from **`astronomy-engine`** (MIT, zero transitive
deps), computed **entirely in the browser** — no API, no key, no network.
`lib/astro.ts` derives events from geocentric, apparent, **tropical,
ecliptic-of-date** longitudes (the frame serious astrology uses):

- **Moon phases** (New/Quarters/Full, with the Moon's sign)
- **Sign ingresses** — Sun, all planets, and the fast **Moon** ingresses
- **Void-of-course Moon** — from the Moon's last aspect to the classical seven
  before it changes sign
- **Retrograde stations** (retrograde/direct)
- **Major aspects** between planets (conjunction/sextile/square/trine/opposition)
- **Eclipses** (solar/lunar)

`eventsForMonth(year, monthIndex, locale)` returns `AstroEvent[]` (memoised per
locale+month). Longitudes use the `EQJ → ECT` rotation (`Rotation_EQJ_ECT`) —
verified to match the library's own `SunPosition` to the arcminute. Times are
shown in the **viewer's local timezone**; events are bucketed by local calendar
day. The engine is **timezone-aware but not location(lat/long)-aware** —
geocentric, so it doesn't filter eclipse visibility or compute
rise/set/houses/planetary-hours. All wording is in `lib/astroText.ts`;
`astro.ts` itself is math + glyphs only.

- **Do NOT replace this with a shallow "sun-sign horoscope" API** — that's exactly
  the hipster-fake astrology the owner rejected. If more accuracy/features are
  wanted, extend the derivations here (e.g. lunar days, planetary hours — those
  are location-dependent, so they'd need the viewer's coordinates).
- The math (`crossings`/`refine`, wrap-angle guards) is generic root-finding over
  longitude/speed functions; add new event types by writing a generator that
  pushes `Raw` events.

## Commands (Taskfile)

`task` lists everything. All npm-based tasks run in a container with deps in the
`gaias-choice-node-modules` volume.

| Command | What |
| --- | --- |
| `task dev` | FE + BE together (Vite HMR :5173 + backend air hot-reload :8787) via `compose.dev.yaml` (needs a TTY — see development.md) |
| `task be:dev` | backend only, `go run .` on :8787 |
| `task be:test` / `be:tidy` / `be:gen` / `be:image` / `be:run` / `be:verify` / `be:tunnel` | backend: vet+test / tidy+verify / regen OpenAPI server code / build image / run prod image / spec-drift+test+image gate / `ngrok http 8787` |
| `task typecheck` | strict `tsc --noEmit` (Vite build does NOT type-check) |
| `task build` | build SPA to `dist/` |
| `task images` | optimize `public/images` to WebP |
| `task mandalas SET=<name>` | generate mandala SVG art for a config set |
| `task lock` | regenerate `package-lock.json` (no scripts) |
| `task audit` | `npm audit` |
| `task image` | build the production Docker image |
| `task run` | build image + run on :8080 |
| `task verify` | audit + typecheck + image build |
| `task deploy` | `gcloud run deploy --source .` (not the current live path) |
| `task clean` | remove dist, deps volume, task cache, image |

`task dev` regenerates deps only when `package.json`/`package-lock.json` change
(tracked via `.task/`). To reset deps entirely: `task clean`.

## Container & deploy

- **Dockerfile** is multi-stage: `node:22-alpine` builds, `nginx:1.27-alpine`
  serves `dist/`. nginx listens on `$PORT` (default 8080), which Cloud Run injects.
- `nginx/default.conf.template` is envsubst'd at boot by the base image. Only
  `${PORT}` is substituted; nginx runtime vars like `$uri` are left intact.
- **SPA fallback:** unknown paths return `index.html` so client routing works.
  Note: a missing `/images/foo.png` therefore returns `index.html` (200), not a
  hard 404 — only `/assets/` is strict-404. Harmless today; change the nginx
  config if you need real 404s for assets.
- **Live deploy is GitHub Pages:** every push to `main` triggers
  `.github/workflows/deploy-pages.yml` (build + publish; `BASE_PATH` drives the
  Vite base). Cloud Run (`task deploy`) remains available but is not the
  current default. Commit/push rules: SKILL.md "Committing & shipping".

## Backend (optional Go/gin API sidecar)

`backend/` is a **static-first progressive enhancement**: a Go + gin JSON API,
**API-only**, that adds features (a future admin/writer portal) without the
static site ever depending on it. **Invariant: the static site works
identically with the backend absent.** The BE now runs on a small Hetzner VM
(AlmaLinux, Helsinki) with Caddy-terminated TLS at
`gaias-choice.gardenofatlantis.com`, and the live Pages build is wired to it via
`VITE_API_URL`. BE-powered UI still renders only when the API answers, so if the
VM is down the live site silently degrades to the static baseline.

- **Shape — contract-first:** port **8787**, routes under `/api`, every
  endpoint born in **`backend/openapi.yaml`** (the single source of truth).
  `task be:gen` (pinned oapi-codegen, containerized, run-not-imported like
  air) regenerates `internal/httpapi/gen.go` — committed, and `be:verify`
  fails if regeneration produces a diff — whose `StrictServerInterface` the
  handlers must implement, so an endpoint that isn't in the spec can't exist.
  Layout: `main.go` is wiring only; `internal/config` (env), `internal/store`
  (SQLite via `modernc.org/sqlite`, pure-Go so `CGO_ENABLED=0` stays static;
  WAL; hand-rolled embedded-`.sql` migration runner; **all SQL lives here**),
  `internal/auth` (users/sessions/roles), `internal/content` (the live-edit
  seam), `internal/httpapi` (gin router, hand-written CORS allowlist,
  middleware, handlers). Endpoints: `/api/healthz`, `/api/hello` (hits counter
  proving a DB round-trip), `/api/auth/{login,register,logout,me}`,
  `/api/users` (the campfire listing), `PUT /api/users/me` (self-service
  profile edit — display name, email, avatar URL, optional password
  change), `/api/content/{file,save}`.
- **Auth (users/sessions/roles):** `users` rows (argon2id password hashes,
  public `display_name`) carry role `admin`, `editor`, or `viewer`.
  **Self-registration is open** (`POST /api/auth/register`, per-IP
  rate-limited) and creates **viewers** — real accounts that may sign in and
  see the community, but **can never touch content**; editors are an admin
  concern (future portal). Login and register (both per-IP rate-limited)
  issue an opaque 30-day bearer session token; only its sha256 lands in
  `sessions`, and logout revokes it. Enforcement is **spec-driven**:
  operations marked `security: session` in `openapi.yaml` are checked by the
  session middleware (keyed off the generated `SessionScopes` marker), and
  the `editor` **scope** (`session: [editor]`, on both content ops) demands
  an admin/editor role — viewers get 403. Protecting a new endpoint =
  declaring it in the spec. The first admin is bootstrapped from env
  (`BOOTSTRAP_ADMIN_EMAIL`/`BOOTSTRAP_ADMIN_PASSWORD`) **only while the users
  table is empty**; `task dev` defaults these (`dev@local`/`dev-password`) so
  local editing works with zero setup — nuke `backend/data/` to re-bootstrap.
- **Content seam (live-edit):** `/api/content/{file,save}` (session-authed)
  sit behind one `content.Store` interface with two backends, chosen at boot
  (the BE logs which). **Prod — GitHub:** proxies the **GitHub Contents API**
  so the in-browser editor writes the same `content/` files that are the
  site — **every save is a git commit and git stays the only source of
  truth** (no DB overlay; a save publishes via the normal Pages deploy,
  ~2 min); needs `GITHUB_TOKEN` (fine-grained PAT, Contents RW this repo
  only; `GITHUB_REPO`/`GITHUB_BRANCH`/`GITHUB_API` have defaults). **Dev —
  local:** if `LOCAL_CONTENT_DIR` is set (the repo root; `task dev` sets
  `/app`), saves write the **working tree directly** — no commit, no deploy,
  no `GITHUB_TOKEN` — so local portal edits are sandboxed and HMR reflects
  them; `LOCAL_CONTENT_DIR` **takes precedence** over any `GITHUB_TOKEN`, so
  dev edits can't leak to the repo. **Neither configured ⇒ content routes
  answer 503 "editing not configured"** and `/api/auth/me` reports
  `editing: false` (it also reports false for viewers — `editing` = storage
  configured ∧ admin/editor role), so the FE keeps edit chrome off unless a
  save could actually land. Validation stays dumb and stateless: `content/`-only path allowlist
  (traversal ⇒ 400), 256 KB size cap, and a sha handle for conflict safety
  (mismatch ⇒ 409; the FE re-fetches, re-applies, retries once) — GitHub's
  blob sha in prod, a content hash locally. The BE never parses YAML — that
  happens on the FE.
- **Login & accounts (FE side):** `src/lib/session.tsx` is the one session
  seam — it owns the token (`localStorage['gc-session']`), validates it
  against `/api/auth/me` on every load (401 ⇒ silent drop), exposes
  login/register/signOut, and renders `components/LoginDialog.tsx` (centered
  sign-in / create-account modal over a blurred backdrop). Chrome is gated on
  `backendUp` (a `/healthz` probe when signed out): `components/UserButton.tsx`
  (header, left of the palette switcher, mobile included) renders **only when
  the API answers** — signed out it opens the dialog, signed in it shows the
  user's initial (or avatar image, once set) and links to `/account`
  (`pages/Account.tsx`): the **campfire** — every registered user seated in a
  circle around an animated fire (display name + initial-letter or avatar
  image, cropped/zoomed the same way as Compass's epic thumbnails — see
  `.avatar-img` in `styles.css`; `you` marked). Beside the scene,
  `components/AccountFields.tsx` is a self-service form — name, avatar URL,
  email, password (Save appears only once a field is dirty; role is shown but
  not editable — that's an admin concern) — that lives in the standard right
  rail (`.reviews-layout`, same as Reviews/Journal/Compass) on desktop,
  always visible; below 900px it's hidden and reachable instead via a
  `.user-toggle` pencil button next to the title (`.account-header`), pure
  CSS-driven (no JS breakpoint branch — see `.account-fields`/
  `.account-fields-toggle` in `styles.css`). A sign-out button sits below the
  scene. BE down ⇒ none of this exists — **readers ship zero account/editing
  chrome**.
  Passwords are the stopgap; magic-link (needs SMTP) and WebAuthn are the
  plan.
- **Edit mode (FE side):** `src/lib/editMode.tsx` is now a thin consumer of
  the session: `active` simply mirrors `/api/auth/me`'s role-aware
  `editing` flag. `#edit` in any URL stays as the deliberate shortcut —
  signed out it opens the login dialog, signed in it's a no-op.
  `src/lib/contentEditor.tsx`
  is the editor popup: field edits do **CST-level, byte-preserving YAML
  surgery** with the existing `yaml` dep (only the edited scalar's line
  changes — the Document API would re-fold long block scalars, so the CST
  route is load-bearing, not a style choice), and the draft composer creates
  new content files (save without sha). Zone addresses (`EditRef`) come only
  from provenance getters in `src/lib/content.ts` (locale fallback means RU
  pages often edit the EN file — components never guess paths).
- **Storage (D9):** SQLite at `${DATA_DIR}/gaia.db`. Local: `backend/data/`,
  git-ignored, nuke to reset. Server: a **host bind mount**
  `/srv/gaias-choice/data` so backups are a host concern (`sqlite3 … .backup`,
  never `cp` on a live WAL db; Litestream is the upgrade path).
- **FE seam:** `src/lib/api.ts` is the whole contract — `apiGet`/`apiPost`, an
  `ApiError`, a `useApi<T>()` hook, and request/response types. Base URL =
  `VITE_API_URL` if set (the compose dev loop and the Pages build both set it —
  the latter to the VM API) else same-origin `/api`. It fails quietly (consumers
  render null on error) and guards against
  the SPA-fallback trap (HTML-200 for `/api/*` on Pages ⇒ "unavailable").
- **Toolchain:** containerized like npm — `golang:1.25-alpine`, module+build
  cache in the `gaias-choice-go-cache` volume, `be:*` tasks. Nothing on the
  host. `task dev` runs FE+BE together (see Commands); `air` gives BE hot
  reload in dev (run-not-imported, pinned in `compose.dev.yaml`).
- **Deploy (D8, live — manual):** the backend runs on the Hetzner VM as the
  `deploy/` compose stack (`api` + a `caddy` service terminating TLS for
  `gaias-choice.gardenofatlantis.com`), brought up by hand with
  `docker compose`. The image is built + pushed to GHCR by
  `.github/workflows/build-backend.yml` and pinned in `BE_TAG`. **doco-cd
  GitOps auto-redeploy is prepared but deferred** (`.doco-cd.yml` +
  `deploy/compose.yaml`). Provisioning record + redeploy/backup steps:
  `deploy/infra-log.md`. The static site never moves off Pages by this.

## Supply chain (the reason for the container dance)

The owner wants the npm surface kept off the host and minimal.

- `.npmrc` → `ignore-scripts=true`: lifecycle scripts (postinstall, etc.) never
  run. The chosen deps don't need them; keep it that way.
- All npm work runs in `node:22-alpine`; `node_modules` lives in a named Docker
  volume, so it never lands in the working tree. If you see a `node_modules/` on
  the host it's an empty mount stub — safe to delete.
- `package-lock.json` pins the full tree; `task audit` must stay at 0 vulns.
- Runtime deps (6): `react`, `react-dom`, `react-router-dom`, `marked`, `yaml`,
  `astronomy-engine`. `marked`, `yaml`, and `astronomy-engine` are all
  browser-safe with zero/low transitive deps (`astronomy-engine`: zero deps,
  no install script).
- **Backend (Go) follows the same stance:** toolchain containerized
  (`golang:1.25-alpine`, cache in the `gaias-choice-go-cache` volume, never on
  the host); `go.sum` pins the full tree, verified by `go mod verify` in
  `be:tidy`/`be:test`. **Four direct deps:** `github.com/gin-gonic/gin`,
  `modernc.org/sqlite` (pure Go, keeps the binary static, no cgo),
  `github.com/oapi-codegen/runtime` (the small helper package the generated
  server code needs), and `golang.org/x/crypto` (argon2id password hashing;
  already in gin's tree). CORS, the migration runner, and the login rate
  limiter are hand-written rather than pulled in. `air` (dev hot reload) and
  the oapi-codegen CLI are **run-not-imported** — pinned in
  `compose.dev.yaml` / the Taskfile, never in `go.mod` or the prod image.

## Dev gotchas

- **ngrok / tunnels:** `vite.config.ts` allows `.ngrok-free.app`, `.ngrok.app`,
  `.ngrok.io` under `server.allowedHosts` (Vite 6 blocks unknown hosts). Dev-only.
- **Type-checking** is separate from building. CI/pre-deploy should run
  `task typecheck` — `vite build` alone will happily ship type errors.
- **Verifying visually:** build (`task build`) and serve `dist/` with any static
  server; because it's an SPA, deep links only resolve via the nginx fallback, so
  when testing on a plain static server, load `/` and navigate by clicking.
- More (YAML quoting traps, BASE_PATH, TTY): "Known gotchas" in
  `references/development.md`.

## Current content state (bootstrap mode)

The owners are first-time site builders learning the affiliate-content business
in public. Where things stand (keep this section current *and short* — it
describes the phase, not the history):

- **Compass courses:** founder course, `trophology`, `inside-websites`, and
  `herbalism` complete; `homeopathy` at chapters 1–3 of 11. The founder
  guides are internal playbooks deliberately published as a course — don't
  "fix" them into consumer content; retelling them from lived experience is a
  roadmap milestone. The launch checklist carries an open item to label each
  reader course's provenance at its top.
- **Journal:** one seed entry — an explicit fill-in template — plus the
  copy-a-blank-template button; a couple of `state: upcoming` stubs queued.
- **Reviews:** the six *active* `products/*` are still **AI placeholder
  reviews** with fake affiliate URLs (`EXAMPLE…`) — slated for
  deletion/replacement per the launch checklist. Never add a real affiliate
  program while these exist. Their images are mandala SVGs; real product
  photos replace them when reviews ship. The real pipeline is the
  `state: upcoming` stub files feeding the "in the works" rail.
- **Pages:** `/roadmap` is public building-in-public — keep it updated when
  milestones land. `/disclosure` and `/privacy` are compliance groundwork,
  required before joining any affiliate program.
- **The camper family is real** — Lidia & Denis, baby born Jan 2025, two
  Basenjis, a self-built campervan; verified facts in
  `context/persona-context.md` ("The family — real biography"). Don't
  extrapolate beyond that file (no invented durations, routes, or gear
  experiences). `contact.md` email + `site.yaml` socials are still
  placeholders.

## Status & shipping

Git repo on `main`, remote `origin` (GitHub). **Never commit automatically —
ask the owner first.** A push to `main` is a production deploy. The full
commit/shipping procedure (Conventional Commits, no deploy-watching, future PR
flow) is SKILL.md "Committing & shipping".
