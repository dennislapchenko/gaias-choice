# CLAUDE.md

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
  site.yaml              # site name, tagline, mission, nav, values, heroImage, social
  themes.yaml            # color palettes (tag + label + default + colors)
  products/*.md          # reviews  → /reviews/<filename-without-.md>
  guides/*.md            # guides   → /guides/<filename-without-.md>
  pages/*.md             # standalone pages (about, contact)
public/
  images/*.webp          # optimized images referenced by content (see Images)
  favicon.svg
src/
  main.tsx               # React root + BrowserRouter
  App.tsx                # route table
  lib/
    content.ts           # loads + parses all content at build time (the core)
    theme.ts             # applies/persists color palettes (CSS var overrides)
    astro.ts             # in-browser ephemeris → celestial events (astronomy-engine)
    types.ts             # SiteConfig, Product, Guide, Page, Theme, AstroEvent
  components/            # Layout, Sidebar, AstroCalendar, ThemeSwitcher,
                         # ProductCard, GuideCard, Markdown, Rating
  pages/                 # Home, Reviews, ReviewDetail, Guides, GuideDetail,
                         # MarkdownPage (about/contact), NotFound
  styles.css             # single hand-written stylesheet (no CSS framework)
Dockerfile               # multi-stage: node build -> nginx runtime
nginx/default.conf.template  # $PORT + SPA fallback (envsubst at container boot)
Taskfile.yml             # all common commands
```

## How content loading works (`src/lib/content.ts`)

This is the heart of the site. At **build time**:

- `import.meta.glob('../../content/<kind>/*.md', { query: '?raw', eager: true })`
  pulls every markdown file in as a raw string. Nothing is fetched at runtime.
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

Create `content/products/<slug>.md`:

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

`content/guides/<slug>.md` — same idea, fields: `title`, `excerpt`, `image?`,
`date`, `tags?`.

### Adding a standalone page

`content/pages/<slug>.md` with just `title`. Then wire a route in `App.tsx`
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
- The current placeholder images are AI art and thematically unrelated to the
  products — swap for real photos before launch (one-line frontmatter change each).

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
- `components/ThemeSwitcher.tsx` (in the header) lists every palette with swatches,
  its **label and `tag`**, and marks the `default`.
- **To add a palette:** append an entry to `themes.yaml` — no code change. There
  are currently 7 (meadow, bubblegum, citrus, periwinkle, lagoon, sunset, grape).
- **To make one permanent/default:** set `default: true` on it (and remove it from
  the others). The current default is **bubblegum**. The `:root` values in
  `styles.css` are the pre-JS fallback — keep them in sync with whichever palette
  is `default` if you care about the first-paint frame.

## Sidebar & celestial almanac

`components/Layout.tsx` wraps every page in a two-column shell
(`.layout-grid`): a left `Sidebar` + the routed content. The sidebar is sticky on
desktop and drops **below** the content on phones (`@media (max-width: 900px)`).
`Sidebar.tsx` is the container for "funky" widgets — add more
`<section className="side-card">` blocks there.

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

`eventsForMonth(year, monthIndex)` returns `AstroEvent[]` (memoised per month);
`AstroCalendar` calls it per viewed month. Longitudes use the `EQJ → ECT`
rotation (`Rotation_EQJ_ECT`) — verified to match the library's own `SunPosition`
to the arcminute. Times are shown in the **viewer's local timezone**; events are
bucketed by local calendar day.

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

## Status

Git repo initialized on `main`. Historically left staged-but-uncommitted — the
owner decides when to commit. Do not commit or push unless asked.
