# CLAUDE.md

1. Don’t assume. Don’t hide confusion. Surface tradeoffs.
2. Minimum code that solves the problem. Nothing speculative.
3. Touch only what you must. Clean up only your own mess.
4. Define success criteria. Loop until verified.

Guidance for working in this repo. Read this first; it captures decisions that
aren't obvious from the code.

## What this is

**Gaia's Choice** — a content site for honest reviews of natural, plastic-free,
fragrance-free gear for **family travel with a baby** (framed generally: camper,
car, or carry-on — not RV/van-specific). It is a **client-rendered SPA**, not an
SSR/SSG site.

- **Stack:** Vite + React 18 + TypeScript, `react-router-dom` (BrowserRouter).
- **Content:** authored as Markdown + YAML in `content/`, bundled at build time.
  No backend, no database, no CMS, no runtime data fetching.
- **Serving:** static build served by nginx in a container, targeting Google Cloud Run.

## Golden rules

1. **Content is data, code is layout.** Adding/editing a review, guide, or page
   must NOT require touching `src/`. If it does, the content model is being
   bypassed — fix the model instead.
2. **npm never runs on the host.** All install/build/lint runs inside a
   throwaway `node:22-alpine` container; deps live in a Docker volume. See
   "Supply chain" below. Don't add a plain `npm install` step to any workflow.
3. **Minimal dependencies.** 5 runtime deps only. Adding one is a real decision —
   prefer a few lines of code over a new package, and never add something with
   install scripts (`.npmrc` sets `ignore-scripts=true`).

## Directory map

```
content/                 # ALL editable content (no code)
  locales/
    README.md            # how the per-locale content layout works
    en/                   # English — source of truth, always complete
      site.yaml           # site name, tagline, description, bio, mission, nav, values, heroImage, social, url, epics, upcoming
      products/*.md       # reviews  → /reviews/<filename-without-.md>
      guides/<epic>/*.md  # guides, grouped in per-epic subfolders → /guides/<filename-without-.md> (subfolder is organizational only, not part of the route)
      pages/*.md          # standalone pages (about, contact, roadmap, disclosure, privacy)
    ru/                   # Russian — filled in section by section, falls back to en/
  shared/
    diagrams/*.svg       # guide diagram templates ({{slot}} tokens) — geometry authored once, reused by every locale (see Adding a guide)
  themes.yaml            # color palettes (tag + label + default + colors) — shared, not localized
context/                 # authoring context (NOT bundled into the site)
  persona-context.md     # the author's voice + the family's REAL biography — read before writing/rephrasing RU content or any "who we are" copy
  ideology-context.md    # influences by domain: Health (Chek, Asprey) / Worldview (Buhner, Daragan, Ralston) / Children (Steiner, Swan) — extensible; Health governs food claims
  plan-rephrase-ru-voice.md  # pending task: rephrase all RU content in her voice
  epic-writing-context.md  # blueprint for 11-chapter Compass epic courses (curriculum, Thread weave, chapter anatomy)
  course-plan-homeopathy.md  # «Гомеопатия дома»: full 11-chapter outline, concepts, seeds (ch. 1–3 shipped)
  course-plan-herbalism.md   # «Домашний травник»: full 11-chapter outline, concepts, seeds (ch. 1–3 shipped)
  course-plan-building-in-public.md  # «Честный сайт с нуля»: the founder guides as a 5-chapter course (complete; sanctioned 5-chapter deviation)
public/
  images/*.webp, *.svg   # optimized photos + generated mandala art (see Images)
  favicon.svg
scripts/
  generate-mandala.mjs   # generates mandala SVG art (guides/reviews sets, see Images)
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
    astro.ts             # in-browser ephemeris → celestial events (astronomy-engine)
    types.ts             # SiteConfig, Product, Guide, Page, Theme, AstroEvent
  components/            # Layout, Sidebar, AstroCalendar, ThemeSwitcher,
                         # LanguageSwitcher, ProductCard, GuideCard, GuideRow,
                         # UpcomingReviews, Markdown, Rating
  pages/                 # Home, Reviews, ReviewDetail, Guides, GuideDetail,
                         # MarkdownPage (about/contact), NotFound
  styles.css             # single hand-written stylesheet (no CSS framework)
Dockerfile               # multi-stage: node build -> nginx runtime
nginx/default.conf.template  # $PORT + SPA fallback (envsubst at container boot)
Taskfile.yml             # all common commands
TRANSLATION_STATUS.md    # Russian translation checklist — delete once fully translated
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
- The body is rendered to HTML with `marked` and injected via
  `dangerouslySetInnerHTML` in `components/Markdown.tsx`. **Content is trusted**
  (author-controlled), so this is intentional — do not accept untrusted markdown
  here without sanitizing.
- **The filename (minus `.md`) is the slug / URL.** Renaming a file changes its
  URL. Nothing hardcodes slugs; they're derived from paths.
- Collections are sorted by `date` descending.

### Adding a review

Create `content/locales/en/products/<slug>.md` (add a matching file under
`ru/` too, once translated — see "Language switching / i18n" below):

```markdown
---
title: Product Name
category: Sleep          # becomes a filter chip on /reviews
rating: 5                # 0–5, rendered as stars
price: "$28"             # optional, quote it
affiliateUrl: "https://...?tag=gaiaschoice-20"   # optional; rel=sponsored
excerpt: One-line summary shown on cards.
image: /images/name.webp # optional; path under public/
date: 2026-06-20         # YYYY-MM-DD, controls ordering
tags: [organic, cotton]  # optional
---

Markdown body…
```

### Adding a guide

`content/locales/en/guides/<epic-tag>/<slug>.md` — same idea, fields: `title`,
`excerpt`, `image?`, `date`, `tags?`, `chapter?` (number). The `<epic-tag>`
subfolder (e.g. `guides/homeopathy/`) exists purely to keep `content/guides`
from becoming one flat pile of files — it plays no role in routing or content
loading (`content.ts` globs `guides/**/*.md` and slugs are always just the
filename); a guide's epic membership is decided entirely by its **first tag**,
independent of which folder it physically sits in. The section is user-facing
**"Compass" / "Путь"** (nav + `guides.title`) — deliberately not called
"Guides"/"Courses"/"Learn" in any visible copy, though it's framed as
course-like collections internally — but the **route and content dir stay
`/guides`** internally. **A guide's FIRST tag is its "epic"** (a course): the
Compass page shows epics as thumbnails (tabs) and lists the selected epic's
items, with the epic's `blurb` as a course intro. Epic metadata (title,
thumbnail, blurb) is configured in
`site.yaml` `epics:` (`GuideEpic` in `lib/types.ts`); the first configured epic
is the default. Three epics exist: `founder-guide` («Честный сайт с нуля» /
"An honest site from zero" — the 5 founder guides as a complete 5-chapter
course, retrofit 2026-07-05) plus two reader-facing 11-chapter courses in
progress — `homeopathy` («Гомеопатия дома») and `herbalism` («Домашний
травник»), chapters 1–3 each shipped 2026-07-05; all outlines live in
`context/course-plan-*.md`.
**Ideology:** each epic should read like a complete, streamlined free course.
See the "New Compass epic" task in `references/development.md`.

Optional `chapter: N` orders guides within an epic for course sequencing
(ascending, independent of `date`); guides without it keep the existing
date-descending order (`Guides.tsx`). `GuideRow` (the `/guides` epic listing),
`GuideCard` (homepage teaser), and `GuideDetail` all show a small "Chapter N"
label when set. Guide detail pages (`GuideDetail.tsx`) also render
a page-local table of contents from the guide's `h2`/`h3` headings — a sticky
column next to the article on desktop, a `<details open>` block on mobile
(expanded by default, still collapsible by tapping the summary), only once a
guide has 3+ headings (`components/TableOfContents.tsx`). `.detail-layout`
(`styles.css`) uses `grid-template-areas` with four regions — `nav` (the
"Back to the Compass" link + tags, its own `.detail-nav` wrapper), `header`
(`.detail-header`: title + date + hero image, split out of the article so the
TOC can sit below it), `article` (the markdown body), and `toc` — laid out as
`nav`/`nav`, `header`/`toc`, `article`/`toc` so the back-link spans full width,
the TOC is a sticky right column beside header+body, and on mobile
(`display: flex` + `order`) the stack is **nav → header (title + image) → TOC →
body**. (Review detail pages keep the title/image inside `.detail`, since they
have no TOC.)
Heading anchor ids are stamped at markdown-render time by a custom `marked`
renderer in `lib/content.ts` (`headingIdRenderer`), slugified with Cyrillic
transliteration so Russian headings still get stable, readable anchors. See
the "Guide chapter ordering" / "Guide detail table of contents" rows in
`references/development.md` for the full mechanics, and
`context/epic-writing-context.md` for the 11-chapter course blueprint this
supports.

Guide chapters also **embed their own visuals in the markdown** (since
2026-07-05): GFM tables (`gfm: true`; styled by `.prose table`) and SVG
diagrams. Tables stay inline per locale (they're just text). **Diagram geometry
is authored once as a shared template** and reused by every locale (2026-07-05):

- `content/shared/diagrams/<name>.svg` — one SVG per diagram, drawn once, with
  `{{slot}}` tokens where locale text goes (`{{aria}}` in the `aria-label`,
  `{{t1}}…{{tN}}` for the `<text>` runs; `{{caption}}` is the figcaption).
- A guide embeds one via a fenced block — <code>\`\`\`diagram &lt;name&gt;</code>
  whose YAML body supplies the slot values — placed in *each* locale's markdown
  next to the prose. So the geometry is never duplicated across locales; only the
  text differs. Fenced blocks (not raw `<figure>` HTML) also sidestep the
  "no blank lines inside a markdown HTML block" trap.
- The renderer lives in `lib/content.ts` (`renderDiagram` + a `marked`
  `renderer.code` override): it loads the templates via glob, YAML-parses the
  slot block, HTML-escapes every value, substitutes `{{slots}}`, **suffixes all
  SVG `id=`/`url(#…)` per instance** (`-i<n>`, so marker ids never collide when
  diagrams share a page), and wraps the result in `<figure class="diagram">` +
  `<figcaption>`. A bad template/slot renders a visible `⚠` figcaption +
  `console.error` rather than throwing (a throw would blank the SPA). Diagrams
  color themselves with the palette CSS variables, so they re-theme with the
  switcher; every svg keeps `role="img"` + a localized `aria-label`.

Authoring rules + the template workflow:
`.claude/skills/manage-site/references/content-editing.md`, "Visuals inside
guides".

### Adding a standalone page

`content/locales/en/pages/<slug>.md` with just `title` (optional `image:`
frontmatter — used when a sidebar panel links to the page, e.g. the `about`
panel). Then wire a route in `App.tsx`
(`<Route path="/x" element={<MarkdownPage slug="x" />} />`) — pages are the one
content type that needs a route because their URLs are bespoke.

## Images

Source images are large PNG/JPG. They are optimized to resized WebP and committed
under `public/images/`. Referenced from content by absolute path (`/images/x.webp`).

- **Optimize:** drop raster files into `public/images/` and run `task images`.
  It runs ImageMagick in a container, converts PNG/JPG → WebP (shrink-only cap
  at 1400px, quality 80), and **removes the originals**. It does NOT rewrite
  content references — update frontmatter `image:` paths by hand afterward.
- Typical result: ~90% smaller than source PNGs.
- **Mandala SVG art** — both guide chapters and product reviews use a
  radial-symmetry "mandala" (rotated `<use>` copies of one petal motif around a
  center, plus a bespoke central icon per topic, e.g. a compass for the
  kickstart playbook, a honeycomb hexagon for beeswax wraps) instead of stock
  photos, matching the site's cosmic/sacred-geometry look. No `task images`
  step needed (vector, not raster). The original 11 guide-chapter SVGs were
  hand-authored one-off, before the generator existed. Since 2026-07-05,
  `scripts/generate-mandala.mjs` generates the shared frame (background
  gradient, petal ring, concentric rings) from a config; only the center icon
  per item is still hand-drawn markup, kept in the script's `SETS` config
  (one named set per content type — currently `guides` for new chapters and
  `reviews`, which replaced all 6 products' AI-art placeholders). Run
  `task mandalas SET=<name>` to (re)generate a set; see the "Mandala SVG art"
  row in `references/development.md` for the full mechanics. Real product
  photos (owners' hands in frame) still replace review mandalas per the
  launch checklist, when they exist.

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
(`@media (min-width: 700px)`); phones keep the full-width look. See the media
query at the bottom of `styles.css`.

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
- `components/ThemeSwitcher.tsx` (in the header) lists every palette with swatches
  and its **label only** (the `tag` id and "· default" suffix are not shown); a ✓
  marks the active one. The `tag` is still the stable id persisted to
  `localStorage['gc-theme']` — it's just no longer surfaced in the menu.
- **To add a palette:** append an entry to `themes.yaml` — no code change. There
  are currently 7 (meadow, bubblegum, citrus, periwinkle, lagoon, sunset, grape).
- **To make one permanent/default:** set `default: true` on it (and remove it from
  the others). The current default is **periwinkle**. The `:root` values in
  `styles.css` are the pre-JS fallback — keep them in sync with whichever palette
  is `default` if you care about the first-paint frame.

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
  site never breaks or shows blank content mid-translation.
- `components/LanguageSwitcher.tsx` (in the header, next to `ThemeSwitcher`)
  is **not** a dropdown: it's a single flag-emoji button that **cycles to the
  next locale on click** (no menu), showing the current locale's flag
  (`LOCALE_FLAGS` in `i18n.tsx`). **On hover the flag flips to the next
  language's flag** (a live preview of where a click leads) and reverts to the
  selected language's flag on `mouseleave` — no tooltip/chip. `ThemeSwitcher` is
  still the dropdown pattern.
- `components/AstroCalendar.tsx` gets month/weekday names + the panel date from
  `Intl.DateTimeFormat(locale, ...)` instead of the string dictionary — new
  locales get correct calendar names for free, no translation entry needed.
- The almanac's **generated event text** (titles, blurbs, planet/sign/aspect
  names) is *not* in the `t()` dictionary — it lives in `src/lib/astroText.ts`,
  one `Vocab` per locale, consumed by `eventsForMonth(year, month, locale)`. A
  new locale needs a `Vocab` entry there or the almanac falls back to English.
- **Adding a locale:** add its code to `SUPPORTED_LOCALES` + `LOCALE_LABELS` +
  `LOCALE_FLAGS` (all in `i18n.tsx`), add `src/locales/<lng>.ts` with every key
  from `en.ts`, add a `Vocab` in `src/lib/astroText.ts` (bodies, sign case forms,
  aspects, tones), and start dropping files into `content/locales/<lng>/`.
- **Russian (`ru`) is fully translated** — UI strings (`src/locales/ru.ts`) and
  all content (`content/locales/ru/`: site.yaml, products, guides, pages). The
  `TRANSLATION_STATUS.md` tracker was deleted once complete, as its own header
  instructed.
- **Do NOT calque proper nouns / terms-of-art when translating.** Keep brand,
  platform, palette, and product/tech terms in English (e.g. **Roadmap** stays
  `Roadmap`, not `Дорожная карта`). The full do-not-translate glossary and the
  reasoning live in `content/locales/README.md` — read it before adding a locale
  or translating new content.

## Sidebar & celestial almanac

`components/Layout.tsx` wraps every page in a two-column shell
(`.layout-grid`): a left `Sidebar` + the routed content. On desktop the sidebar
is a sticky vertical stack of **collapsible panels** (each a flat rectangular
toggle). On phones (`@media (max-width: 900px)`) it rides **above** the content
(`order:0`, in the space freed when the nav collapses to the hamburger) and
renders as a `SidebarMobile` tab-row — a row of rectangular toggles, one open at
a time. `Sidebar.tsx`'s `PANELS` registry defines the panels; the composition +
order are content-driven (`site.yaml` `sidebar:` list, currently `about` +
`missionValues` + `almanac`). The `about` panel surfaces the linked page's
frontmatter `image` (via `getPage`), the site `bio` (a short personal line —
distinct from `description`, which is the longer blurb used on the homepage
hero), and a link to the full `/about` page. The whole panel body is one click
target (`.side-about` + `.side-about-link::after`, the same stretched-link
trick as `.card-link` on product/guide cards) — not just the "Our story" text.
Add a new panel by registering a `{ label, Body, desktopOpen }` entry and
referencing its `type` from `site.yaml`.

The first widget is `AstroCalendar.tsx`: a month grid where days with celestial
events are marked with astrological glyphs. Hovering/focusing/clicking a marked day
updates a detail panel below the grid (a panel, not a floating tooltip, because a
tooltip clips in the ~300px rail). It defaults to the current month and today's event.

### The ephemeris engine (`lib/astro.ts`) — serious astrology, not "fun"

This is **real, astronomically-grounded astrology** (Konstantin Daragan worldview
— see the user memory). Positions come from **`astronomy-engine`** (MIT, zero
transitive deps), computed **entirely in the browser** — no API, no key, no
network. `lib/astro.ts` derives events from geocentric, apparent, **tropical,
ecliptic-of-date** longitudes (the frame serious astrology uses):

- **Moon phases** (New/Quarters/Full, with the Moon's sign)
- **Sign ingresses** — Sun, all planets, and the fast **Moon** ingresses
- **Void-of-course Moon** — from the Moon's last aspect to the classical seven
  before it changes sign
- **Retrograde stations** (retrograde/direct)
- **Major aspects** between planets (conjunction/sextile/square/trine/opposition)
- **Eclipses** (solar/lunar)

`eventsForMonth(year, monthIndex, locale)` returns `AstroEvent[]` (memoised per
locale+month); `AstroCalendar` calls it per viewed month. Longitudes use the
`EQJ → ECT` rotation (`Rotation_EQJ_ECT`) — verified to match the library's own
`SunPosition` to the arcminute. Times are shown in the **viewer's local
timezone** (locale-formatted); events are bucketed by local calendar day. The
engine is **timezone-aware but not location(lat/long)-aware** — geocentric, so it
doesn't filter eclipse visibility or compute rise/set/houses/planetary-hours.
All wording is in `lib/astroText.ts` (see the i18n section); `astro.ts` itself is
math + glyphs only.

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
| `task dev` | Vite dev server on :5173 |
| `task typecheck` | strict `tsc --noEmit` (Vite build does NOT type-check) |
| `task build` | build SPA to `dist/` |
| `task images` | optimize `public/images` to WebP |
| `task lock` | regenerate `package-lock.json` (no scripts) |
| `task audit` | `npm audit` |
| `task image` | build the production Docker image |
| `task run` | build image + run on :8080 |
| `task verify` | audit + typecheck + image build |
| `task deploy` | `gcloud run deploy --source .` (override `REGION=`/`SERVICE=`) |
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
- **Deploy:** `task deploy` (or `gcloud run deploy gaias-choice --source .
  --region … --allow-unauthenticated --port 8080`). Domain mapping instructions
  are in `README.md`.

## Supply chain (the reason for the container dance)

The owner wants the npm surface kept off the host and minimal.

- `.npmrc` → `ignore-scripts=true`: lifecycle scripts (postinstall, etc.) never
  run. The chosen deps don't need them; keep it that way.
- All npm work runs in `node:22-alpine`; `node_modules` lives in a named Docker
  volume, so it never lands in the working tree. If you see a `node_modules/` on
  the host it's an empty mount stub — safe to delete.
- `package-lock.json` pins the full tree; `task audit` must stay at 0 vulns.
- Runtime deps: `react`, `react-dom`, `react-router-dom`, `marked`, `yaml`,
  `astronomy-engine`. `marked`, `yaml`, and `astronomy-engine` are all browser-safe
  with zero/low transitive deps (`astronomy-engine`: zero deps, no install script).

## Dev gotchas

- **ngrok / tunnels:** `vite.config.ts` allows `.ngrok-free.app`, `.ngrok.app`,
  `.ngrok.io` under `server.allowedHosts` (Vite 6 blocks unknown hosts). Dev-only.
- **Type-checking** is separate from building. CI/pre-deploy should run
  `task typecheck` — `vite build` alone will happily ship type errors.
- **Verifying visually:** build (`task build`) and serve `dist/` with any static
  server; because it's an SPA, deep links only resolve via the nginx fallback, so
  when testing on a plain static server, load `/` and navigate by clicking.

## Current content state (July 2026)

The site is in **bootstrap mode** — the owners are first-time site builders
learning the affiliate-content business as they go:

- `content/locales/en/guides/founder-guide/*` include the **founder guides**: internal
  how-to-build-this-site playbooks (review process, monetization, traffic/SEO,
  launch checklist, master playbook), deliberately public and since 2026-07-05
  structured as a complete 5-chapter Compass course «Честный сайт с нуля»
  (epic tag `founder-guide`, `chapter:` 1–5, Trail/Bridge weave like the
  reader courses — plan in `context/course-plan-building-in-public.md`).
  Chapters get retold from lived experience as milestones land. Don't "fix"
  them into consumer content by other means.
- The first **reader-facing Compass courses** are in progress: `homeopathy` and
  `herbalism` epics, chapters 1–3 of 11 each (both locales). Chapter 3's
  "next" link is deliberately text-only («готовится») until chapter 4 ships —
  keep that pattern for any course published mid-write.
- `content/locales/en/products/*` are still **AI placeholder reviews** with fake
  affiliate URLs (`EXAMPLE…`) — flagged for deletion/replacement in the launch
  checklist. Never add a real affiliate program while these exist. Their images
  are now mandala SVGs (2026-07-05, see Images), not AI photos — real product
  photos still replace them per the launch checklist.
- The **real** review pipeline is tracked publicly by the `upcoming:` list in
  `site.yaml` — products bought/queued for testing, shown as an "in the works"
  rail on the right of `/reviews` (`components/UpcomingReviews.tsx`, in the
  `.reviews-layout` grid; collapses above the grid on mobile). These are NOT
  reviews (no rating, no affiliate tag — just the product + its Amazon
  listing); delete an entry when its real review ships.
- `/roadmap` (public, building-in-public) tracks phases; keep it updated when
  milestones land. `/disclosure` and `/privacy` are compliance groundwork for
  affiliate programs — required before joining any.
- **The camper family is real** (confirmed 2026-07-05): Lidia & Denis, baby
  born Jan 2025, two Basenjis, a self-built campervan — verified facts live in
  `context/persona-context.md` ("The family — real biography"). `about.md` and
  `site.yaml` `bio` now state only those facts; retelling them in the owners'
  own words is an open roadmap item. Don't extrapolate beyond the bio file
  (no invented durations, routes, or gear experiences). `contact.md` email +
  `site.yaml` socials are still placeholders.

## Status

Git repo on `main`, remote `origin` (GitHub). **Ask the owner before
committing** — never commit automatically. When confirmed: commit on `main`
with a Conventional-Commits message (`feat:`/`fix:`/`docs:`/`content:`/…, plus
the `Co-Authored-By: Claude ...` trailer) and `git push origin main`. **Pushing
`main` is a production deploy** — `.github/workflows/deploy-pages.yml` builds and
publishes to GitHub Pages on every push. Feature branches + PRs are the planned
future flow, not yet active.
