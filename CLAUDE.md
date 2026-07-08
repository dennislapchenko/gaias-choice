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
mechanics for the static site in `references/development.md`; the Go API +
auth + live-edit portal in `references/backend.md`; authoring procedures in
`references/content-editing.md` (all `references/*` live under
`.claude/skills/manage-site/`, not the repo root); voice/worldview source
material in `context/`.
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
  static site works identically without it (see "Backend" below; full
  architecture in the skill's `references/backend.md`).
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
    <kind>-template.<locale>.md   # blank scaffolds seeding new drafts (journal- on
                                  # /journal, review- on /reviews — see the ＋ button
                                  # in the Live-edit row of development.md)
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
                         # Rating, GaiaScore, TableOfContents, CopyButton, EditButton, BackendBadge,
                         # AccountFields, ImagePicker (image chooser — bundled-image grid +
                         # an optional "from your device" upload button; the editor's cover control + inline 🖼)
  pages/                 # Home, Reviews, ReviewDetail, Compass, Journal,
                         # EntryDetail (shared Compass+Journal detail w/ TOC),
                         # MarkdownPage (about/contact/etc), Support,
                         # Account (the campfire), NotFound
  styles.css             # single hand-written stylesheet (no CSS framework)
backend/                 # optional Go/gin API sidecar (see "Backend" below +
                         # skill references/backend.md for the full architecture)
  openapi.yaml           # THE endpoint contract — endpoints are born here (task be:gen)
  main.go, internal/{config,store,auth,content,mail,telegram,enrich,httpapi}, Dockerfile, go.mod
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
(filter chip), `scores` (the **Gaia Score**), optional `price`/`affiliateUrl`
(rendered `rel=sponsored`)/`image`/`tags`/`state`, `excerpt`, `date`. Every
review follows the universal six-section body structure whose canonical source
is `content/shared/review-template.<locale>.md` — the scaffold an editor's ＋
button (on the `Upcoming` rail, edit mode only — see the Live-edit row of
`development.md`) seeds a new draft from. **Layout:** `ReviewDetail` is a
centered two-column grid (`.review-layout`, mirroring `.detail-layout`) — the
reading column plus a sticky right rail (`.review-aside`) that holds the
product facts (price + the Gaia Score bars, and whatever facts get added
later); on mobile (`≤900px`) the rail stacks above the article.

**Gaia Score (review rating).** Reviews are not rated with a single star.
`site.yaml` `ratingCriteria` defines one shared set of criteria (`{title, items}`,
localized; names currently **provisional** — owner to finalize), and each
review's frontmatter `scores:` is an array of 0–5 numbers **aligned to `items`
by index**. `components/GaiaScore.tsx` renders the per-criterion breakdown as a
row of **vertical fill bars** (one column per criterion; fill height = score/5)
in `ReviewDetail`'s sticky right rail (`.review-aside` — see below); `ProductCard`
shows the rolled-up average (its `scoreAverage` helper) as the old single star
row. Adding/renaming a criterion
is a one-line `site.yaml` edit that relabels every review at once — content-as-data,
no per-file churn.

**Post states (reviews + Journal):** a post is `state: active` (absent =
active) or `state: upcoming`. An upcoming post is a real content file that
isn't finished: it drops out of the main listing and shows **title-only** in
the "in the works" rail (shared `Upcoming` component; `getUpcomingProducts`/
`getUpcomingJournal` in `content.ts` merge en + locale **by slug**, locale
wins, so en-only review stubs appear on every locale's rail). Flipping the
frontmatter to active moves it into the main spot — the file never moves.
Detail getters don't filter by state, so a WIP post is previewable at its real
URL, where an admin/editor gets an inline edit button right on the "In the
works" tag to flip `state` to `active` (session-authed, live-edit seam — see
the Live-edit row of `development.md`); readers just see the tag. New drafts
queued via the ＋ button start `state: upcoming`, so they arrive queued, not
live. Compass chapters and pages ignore `state`.

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
  en+ru), `homeopathy` (11, complete, en+ru — a mid-write course's last
  "next" link stays text-only until the next chapter ships),
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
`?year=`); entries list as rows with a left-quarter thumbnail (frontmatter
`image`, else a leaf placeholder) and open through
`EntryDetail`. The landing page
surfaces the section too: a hero "Read the Journal" button and a "Fresh from the
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
  default: true      # the LIGHT palette used when nothing is stored + system=light
  colors: { sage, sageDark, onAccent, clay, sand, sand2, line, mint, peach, lilac }
```

**Light vs dark.** Light palettes set the 10 slots above. Dark palettes add
three optional slots — `ink` (primary text), `muted` (secondary text), `white`
(card/raised surface) — to flip text and cards dark; light palettes omit them
and inherit the light `:root` defaults (`theme.ts`'s `SLOT_DEFAULTS`, which also
reset them when switching a dark palette back to a light one). A first-time
visitor gets a palette by **OS preference**: `default: true` when the system is
light, `defaultDark: true` when it's dark (`matchMedia('(prefers-color-scheme:
dark)')` in `theme.ts`). An explicit pick in the switcher persists to
`localStorage['gc-theme']` and wins over the system default from then on.

Because a dark palette's card `--white` sits close to its `--sand`, panels would
read flat. `theme.ts` also sets two runtime tint vars keyed off dark-ness (a
palette is "dark" iff it sets `ink`): `--panel-tint` (a faint white wash layered
onto sidebar/rail card surfaces + filter chips — `.side-panel-*`, `.toc-nav`,
`.chip`; `transparent` in light) and `--surface-muted`/`--surface-muted-strong` (the "greyed" row surfaces
— `.upcoming-link`, `.epic-row`, `.field` — a dark-ink wash in light that flips
to a white wash in dark, so the tint never vanishes dark-on-dark).

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
  are currently 13: 7 light (meadow, bubblegum, citrus, periwinkle, lagoon,
  sunset, grape) + 6 dark (midnight, forest, plum, ember, abyss, rose).
- **To make one default:** set `default: true` (light) or `defaultDark: true`
  (dark) on it, and remove that flag from the others — exactly one of each. The
  current defaults are **citrus** (light) and **midnight** (dark). The
  `:root` values in `styles.css` are the pre-JS fallback — keep them in sync with
  the light `default` if you care about the first-paint frame.

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
is a sticky vertical stack of **collapsible panels** (capped to
`calc(100vh - 108px)` with its own `overflow-y` so a tall rail scrolls
independently of the central column); on phones
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

`task` lists everything. **All npm/Go tooling runs in containers** (deps in the
`gaias-choice-node-modules` / `gaias-choice-go-cache` volumes) — never host npm.
`task typecheck` is separate from `task build` (Vite build does NOT type-check).
The full command table — FE, the `be:*` backend tasks, deploy, and `clean` — is
in `references/development.md` "Commands".

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

`backend/` is a **static-first progressive enhancement**: a Go + gin JSON API
(port 8787, routes under `/api`) that adds features (login, the in-browser
live-edit portal, LLM enrich/translate) without the static site ever depending
on it. **Invariant: the static site works identically with the backend
absent** — BE-powered UI renders only when the API answers, so if the VM is
down the live site silently degrades to the static baseline. It runs on a
Hetzner VM behind Caddy TLS (`gaias-choice.gardenofatlantis.com`); the live
Pages build is wired to it via `VITE_API_URL`.

**Full backend architecture** — contract-first OpenAPI shape, auth
(Telegram/magic-link/password, roles, sessions), the live-edit content seam,
the account/portal FE, storage, deploy, and the `be:*` tasks — lives in the
manage-site skill reference **`references/backend.md`** (loaded only for
backend work; this keeps ~300 lines of API detail out of every session's
context). The FE↔BE contract is `src/lib/api.ts`; the session seam is
`src/lib/session.tsx`; edit mode is `src/lib/editMode.tsx` +
`src/lib/contentEditor.tsx`.

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
- **Backend (Go) follows the same stance:** containerized toolchain
  (`golang:1.25-alpine`, cache in the `gaias-choice-go-cache` volume, never on
  the host), `go.sum` pins the full tree (`go mod verify` in
  `be:tidy`/`be:test`), five direct deps, hand-written CORS/migrations/rate-limiter,
  `air`/oapi-codegen run-not-imported. Full dep list + rationale:
  `references/backend.md` "Toolchain".

## Dev gotchas

- **ngrok / tunnels:** `vite.config.ts` allows `.ngrok-free.app`, `.ngrok.app`,
  `.ngrok.io` under `server.allowedHosts` (Vite 6 blocks unknown hosts). Dev-only.
- **Type-checking** is separate from building. CI/pre-deploy should run
  `task typecheck` — `vite build` alone will happily ship type errors.
- **DEBUG gate:** `src/lib/debug.ts` exports `DEBUG` — wrap any dev-only chrome
  (viewport read-outs, state dumps) in `DEBUG && …`. On automatically in
  `vite dev`, forceable with `VITE_DEBUG=true|false`, OFF by default in the prod
  Pages build. It's a Vite env gate, **not** a `site.yaml` field — a debug flag
  is dev tooling, and `site.yaml` ships to the visitor bundle.
- **Backend DEBUG** is a separate env from the FE `VITE_DEBUG` above (different
  process, different gate) — the BE's request-logger/gin-mode switch is
  documented in `references/backend.md` "Toolchain".
- **Verifying visually:** build (`task build`) and serve `dist/` with any static
  server; because it's an SPA, deep links only resolve via the nginx fallback, so
  when testing on a plain static server, load `/` and navigate by clicking.
- More (YAML quoting traps, BASE_PATH, TTY): "Known gotchas" in
  `references/development.md`.

## Current content state (bootstrap mode)

The owners are first-time site builders learning the affiliate-content business
in public. Where things stand (keep this section current *and short* — it
describes the phase, not the history):

- **Compass courses:** all five complete — founder course, `trophology`,
  `inside-websites`, `herbalism`, and `homeopathy`. The founder
  guides are internal playbooks deliberately published as a course — don't
  "fix" them into consumer content; retelling them from lived experience is a
  roadmap milestone. The launch checklist carries an open item to label each
  reader course's provenance at its top.
- **Journal:** one seed entry — an explicit fill-in template — plus a couple
  of `state: upcoming` stubs queued.
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

Git repo on `main`, remote `origin` (GitHub). A push to `main` is a production
deploy. **Whether the assistant commits/pushes automatically or asks first is
gated by `.claude/behavior.yaml`** (`AUTO_COMMIT_PUSH`, `COMMIT_PUSH_FOLLOWING`).
The full commit/shipping procedure (Conventional Commits, the flag semantics,
backend `be:deploy` follow-through, future PR flow) is SKILL.md "Committing &
shipping".
