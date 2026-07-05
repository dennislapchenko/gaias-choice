# Development — Gaia's Choice

Stack: Vite 6 + React 18 + TS (strict), `react-router-dom` BrowserRouter,
single hand-written `src/styles.css`, content bundled at build time via
`import.meta.glob` in `src/lib/content.ts`. No backend, no CMS, no runtime
fetching. Architecture details live in the repo `CLAUDE.md` — read it before
structural changes.

## Where things live (change X → edit Y)

Keep this table current — when you add/rename/change a component, update the row
(that's a house rule; see SKILL.md "Update the docs").

| To change… | Edit | Notes |
| --- | --- | --- |
| Page shell: header, nav, **mobile hamburger menu**, footer | `src/components/Layout.tsx` + `.site-header`/`.nav-toggle`/`.site-nav` in `styles.css` | Nav collapses to a hamburger dropdown ≤820px (closes on nav/Escape/outside-click). Nav items come from `site.yaml` `nav:`/`footerNav:`. |
| **Language switcher** | `src/components/LanguageSwitcher.tsx` + `.lang-toggle`/`.lang-flag` in `styles.css` | Flag-emoji button that cycles locale on click (no menu). Flags in `LOCALE_FLAGS` (`lib/i18n.tsx`). On hover the displayed flag swaps to the *next* locale's flag (a `hovered` state on the button toggles which flag renders); reverts on `mouseleave`. No tooltip/chip. |
| **Theme/palette switcher** | `src/components/ThemeSwitcher.tsx` + `.theme-*` | Dropdown; palettes are data in `content/themes.yaml` (`lib/theme.ts` applies them). Each option shows swatches + the **label only** (not the `tag` id / "· default"). |
| **Sidebar** (About, Mission & Values, almanac) | `src/components/Sidebar.tsx` `PANELS` registry + `.side-panel*`/`.side-tab*`/`.side-about*`/`.side-mission`/`.value-badge*` | Each `site.yaml` `sidebar:` entry is a **collapsible panel** (flat rectangular toggle). Types: `about` (the linked page's frontmatter `image` + site `description` blurb + link to `/about`, open by default), `missionValues` (mission + values combined, collapsed by default), `almanac` (open by default; label = `sidebar.title`). Desktop = vertical stack of panels; **≤900px** the rail rides to the top (`order:0`) and renders as a `SidebarMobile` tab-row (one open at a time). Breakpoint via `useIsNarrow` (matchMedia, kept in sync with the 900px CSS). Value icons: `VALUE_ICONS` map + `icon:` on each value. |
| Almanac calendar / astrology | `src/components/AstroCalendar.tsx` + `src/lib/astro.ts` (math/glyphs) + `src/lib/astroText.ts` (all wording, per locale) | Real ephemeris — extend generators, never a horoscope API. `eventsForMonth(y, m, locale)` is locale-aware; event titles/blurbs/body+sign+aspect names come from `astroText.ts` (RU is serious Daragan-style with proper sign case forms). Times/day-bucketing are the viewer's local timezone (not location-aware — see CLAUDE.md). |
| Reviews / guides / pages content | `content/locales/<lng>/…` | Markdown+YAML; see `content-editing.md`. Guides live in per-epic subfolders (`guides/founder-guide/`, `guides/homeopathy/`, `guides/herbalism/`) — organizational only, `content.ts` globs `guides/**/*.md` and the slug is always just the filename. |
| Site name, tagline, mission, values, nav, social, production URL | `content/locales/<lng>/site.yaml` | Per locale; shape in `SiteConfig` (`lib/types.ts`). `url:` is the current GitHub Pages subpath, reference-only until the site moves to a custom domain root. |
| UI chrome strings (labels, aria) | `src/locales/en.ts` + `ru.ts` | Flat `t()` dictionary; keep both in sync. |
| Colors, radii, layout, breakpoints | `src/styles.css` | One stylesheet; CSS vars in `:root`. Breakpoints: 900 (sidebar stacks; guide TOC also collapses here), 820 (nav→hamburger), 720/560/480. |
| **Guide tables & inline-SVG diagrams** | authored in the guide markdown itself; styled by `.prose table` + `.prose figure.diagram` in `styles.css` | GFM tables + `<figure class="diagram"><svg>…` blocks embedded in `content/locales/<lng>/guides/**`. SVGs color themselves with the palette CSS vars (re-theme automatically); tables get the card look + horizontal scroll ≤720px. Authoring rules (no blank lines in the figure block, unique marker ids, overflow audit) + the fast locale-mirroring workflow live in `content-editing.md` "Visuals inside guides". |
| Cards (product/guide) | `src/components/ProductCard.tsx` / `GuideCard.tsx` + `.card`/`.card-link`/`a.tag` in `styles.css` | **Whole card is clickable** via a stretched-link overlay: the title `<Link className="card-link">` paints a full-card `::after` (needs `.card { position: relative }`). Genuinely interactive children are raised above it (`.card-body a.tag { z-index: 2 }`). Media is a plain `<div>` now (not a second link). Grids collapse to 1 col on mobile. `GuideCard` is only used for the homepage "New on the Compass" teaser now — the `/guides` epic listing uses `GuideRow` instead (see below). |
| Review category tag → filtered list | `ProductCard.tsx` tag `<Link>` → `Reviews.tsx` `useSearchParams` | The category chip links to `/reviews?category=<cat>`; `Reviews.tsx` reads the `category` param (validated against known categories, else `All`) so the tag filters from any page, incl. Home. Guide cards use a plain `<span>` tag (no guide taxonomy) so their whole card just navigates. |
| **Guide rows (epic listing)** | `src/components/GuideRow.tsx` + `.guide-row*` in `styles.css` | Fat horizontal bars (175px tall, full-bleed image) instead of the vertical `GuideCard` grid — corner-anchored labels: "Guide" tag top-left, chapter number top-right (no date shown), title bottom-left, excerpt bottom-right (2-line clamp). **The row itself is the `<Link>`** (not a nested `.card-link` on the title) — the title sits in `.guide-row-title`, which is `position: absolute` for corner placement, so a `.card-link::after` nested inside it would take *that* as its containing block and shrink the click target down to the title's own small box instead of the full row (see `.side-about` for the same "outer element is the link" pattern). Title/excerpt text is white with a hard black outline (layered `text-shadow`, `.guide-row-title, .guide-row-excerpt`) for legibility over busy AI-art thumbnails, over a bottom-heavy dark gradient (`.guide-row::before`) for extra contrast. `Guides.tsx` renders them in a `.guide-row-list` (flex column, full width) instead of a `.grid`. **≤640px:** height goes to `min-height` (text can grow the box), excerpt hidden, title spans full width. |
| **Compass section / epics (courses)** | `src/pages/Guides.tsx` + `.epic-strip`/`.epic-thumb*`/`.epic-blurb` in `styles.css`; config in `site.yaml` `epics:` | The Guides section is user-facing **"Compass" / "Путь"** (nav label + `guides.title`) — deliberately not "Guides"/"Courses"/"Learn" in visible copy — framed as course-like collections, but the **route + content dir stay `/guides`** (internal). Epic thumbnails act as tabs; the row list below shows guides whose **first tag** equals the selected epic's `tag`, with the epic's `blurb` shown as a course intro. First epic = default. Membership is data (first tag); display metadata (title, image, blurb) is `site.yaml` `epics:` (`GuideEpic` in `lib/types.ts`). The word "Epic" never appears in UI. Within the visible list, guides with an optional `chapter: N` frontmatter number sort ascending (course order) ahead of un-chaptered ones, which keep date-desc — see "Guide chapter ordering" below. |
| **Guide chapter ordering** | `chapter?: number` on `Guide` (`lib/types.ts`); sort in `Guides.tsx`; label in `GuideRow.tsx` (epic listing), `GuideCard.tsx` (homepage teaser) + `GuideDetail.tsx` via `t('guides.chapter', { n })` | Optional frontmatter field for course-like epics — all three epics now use it (founder-guide got `chapter:` 1–5 in the 2026-07-05 course retrofit). `Guides.tsx` sorts the epic-filtered list: chaptered guides ascending by `chapter`, before/apart from un-chaptered ones (which keep the existing date-desc order — a stable sort). All three surfaces show a "Chapter N" / «Глава N» tag when `chapter` is present. |
| **Guide detail table of contents (TOC)** | `src/components/TableOfContents.tsx` + `.detail-layout`/`.detail-nav`/`.toc*` in `styles.css`; heading ids stamped by a custom `marked` renderer in `src/lib/content.ts` (`headingIdRenderer`) | A **page-local** nav distinct from the site-wide left rail (`Sidebar.tsx`) — it lives inside `GuideDetail.tsx`'s own `.detail-layout` grid, not the app-level `.layout-grid`, so the two rails never compete for the same space. `.detail-layout` uses `grid-template-areas` with three regions — `nav` (the back-link + tags, `.detail-nav`, spans full width), `article`, `toc` — so the back-link row sits above the two-column row on desktop. Built by parsing the guide's already-rendered HTML for `h2[id]`/`h3[id]` (`DOMParser`, no runtime markdown re-parse) — h3s nest under the preceding h2 visually via indent only (flat list, not a real tree). Renders **nothing** below 3 headings. Scrollspy (`IntersectionObserver`, recomputed from `getBoundingClientRect()` against a fixed "read line" under the sticky header) highlights the current heading. Desktop: sticky column, always expanded (`.toc-toggle` hidden). **≤900px** (same breakpoint as the site-wide sidebar): `.detail-layout` becomes a flex column ordered `.detail-nav` → `.toc` → article, and the TOC is a native `<details open>`/`<summary>` block **expanded by default** (still collapsible by tapping the summary), styled like the sidebar's `.side-tab`. Heading ids: `slugify()` transliterates Cyrillic to ASCII (е→e, ж→zh, etc.) then dashes non-alphanumerics, deduping repeats per document (`section`, `section-2`, …) — so RU headings still get stable, readable, scrollable anchors. |
| **Mandala SVG art** | `scripts/generate-mandala.mjs` | Generates the radial-symmetry "mandala" images used for guide chapters and product reviews (gradient background + rotated petal ring, generated; center icon per item, hand-authored markup in config) — see CLAUDE.md > Images. `SETS` holds one named config per content type: `guides` (new chapters only — the original 11 predate this script and are hand-authored, untouched by it) and `reviews` (all 6 current products). Add a new set (e.g. epic thumbnails) by adding a `SETS` key. Run via `task mandalas SET=<name>` (optional `ONLY=slug1,slug2`); output is `public/images/<prefix>-<slug>.svg`. Wire the result into frontmatter `image:` by hand, same as any image. |
| Routes | `src/App.tsx` | Standalone pages need a route here. |
| **Author voice, family bio & worldview (writing/rephrasing content)** | `context/persona-context.md` (how she sounds + the family's REAL biography — the camper family is not fictional) + `context/ideology-context.md` (what we believe: Health = Chek, Asprey; Worldview = Buhner, Daragan, Ralston; Children = Steiner, Swan — extensible; Health governs food/consumption claims) | Read both before authoring/rephrasing RU content, any "who we are" copy, or guides/Compass courses. RU voice rephrase done 2026-07-05 (`context/plan-rephrase-ru-voice.md`). |

## Commands (always via Taskfile — never host npm)

| Command | What |
| --- | --- |
| `task typecheck` | strict `tsc --noEmit` — **`task build` does NOT type-check** |
| `task build` | build SPA to `dist/` |
| `task dev` | Vite dev server :5173 — **needs a TTY** (docker `-it`); fails under preview harnesses/CI |
| `task images` | optimize `public/images` → WebP |
| `task mandalas SET=<name>` | generate mandala SVG art for a config set (`guides`, `reviews`); optional `ONLY=slug1,slug2` |
| `task audit` | `npm audit` — must stay at 0 vulns |
| `task lock` | regenerate lockfile (no scripts) |
| `task verify` | audit + typecheck + image build |
| `task run` | production image on :8080 |
| `task deploy` | `gcloud run deploy --source .` (Cloud Run — not the current live path) |

**Live deploy is GitHub Pages, triggered by pushing `main`** (`.github/workflows/deploy-pages.yml`),
not `task deploy`. Treat a push to `main` as shipping to production. `task deploy`
(Cloud Run) remains available but isn't the current default.

Docker daemon down (`Cannot connect to the Docker daemon`)? This machine uses
OrbStack: `open -a OrbStack`, wait ~15s, retry.

## Verification recipe

1. `task typecheck && task build`
2. Visual/behavioral check — serve the fresh `dist/` statically instead of
   `task dev` (the TTY problem above):

   ```json
   // .claude/launch.json at the workspace root (NOT inside gaias-choice/)
   { "version": "0.0.1", "configurations": [{
       "name": "dist",
       "runtimeExecutable": "python3",
       "runtimeArgs": ["-m", "http.server", "5180", "-d", "gaias-choice/dist"],
       "port": 5180 }] }
   ```

3. **Deep links 404 on a static server** (SPA fallback lives in nginx, not
   `http.server`) — load `/` and navigate by clicking, or drive
   `location.href` via eval. `task run` gives the real nginx behavior when
   fallback itself needs testing.

## Common dev tasks

- **New palette:** append to `content/themes.yaml` (tag, label, 10 color keys —
  see `ThemeColors` in `src/lib/types.ts`). No code change. Exactly one entry
  keeps `default: true`; if you change which, sync the `:root` fallback values
  in `styles.css` (first-paint frame). Check `onAccent` contrast per palette.
- **New route/page:** route in `src/App.tsx`; nav from `site.yaml` `nav:` /
  `footerNav:` (never hardcode links in `Layout.tsx`).
- **Sidebar composition is content-driven:** the left-rail panels + their
  order come from `site.yaml`'s `sidebar:` list (per locale), each entry a
  `type` mapped to an entry in `src/components/Sidebar.tsx`'s `PANELS`
  registry (`about`, `missionValues`, `almanac`). Reorder/drop/repeat = edit `site.yaml`
  only. Each panel is a **collapsible flat-rectangular toggle**; `desktopOpen`
  in the `PANELS` def sets its initial desktop state (mobile always starts
  closed). **New panel type:** add a `{ label, Body, desktopOpen }` entry to
  `PANELS`, then reference its `type` from `site.yaml` (both `en` and `ru`).
  Unknown types are filtered out; no `sidebar:` list falls back to
  `DEFAULT_SIDEBAR`. **Responsive:** ≤900px the rail moves above the content and
  `SidebarMobile` renders the toggles as a one-open-at-a-time tab-row (see the
  `.side-tab*` rules in the `max-width: 900px` block). The almanac
  (`AstroCalendar` + `lib/astro.ts`) is real ephemeris math — extend its event
  generators, never swap in a horoscope API.
- **New Compass epic / course:** add an entry to `site.yaml` `epics:` (`tag`,
  `title`, `image`, optional `blurb` course intro) in **both** `en` and `ru`,
  then tag the guides/checklists/course pieces that belong to it with that `tag`
  as their **first** tag. It appears as a new thumbnail in the Compass section
  automatically; the first `epics:` entry is the default selection. No code
  change (`Guides.tsx` is generic). Ideology: each epic should read like a
  complete, streamlined free course (Fable 5 will author that content).
  **11-chapter epic courses:** the full authoring blueprint (curriculum
  architecture, the «Нить»/Thread navigation weave, chapter anatomy, shipping
  checklist) is `context/epic-writing-context.md` — read it before writing any
  course. Chapters are guides with `chapter: N` frontmatter (orders them 1→11
  inside the epic) and the epic tag first.
- **New content field:** extend the type in `src/lib/types.ts`, render it in
  the component — `content.ts` spreads frontmatter automatically, no parser
  changes needed.
- **New dependency:** a real decision, not a default. Zero-install-script,
  browser-safe, minimal transitive deps (that's why `yaml` not `gray-matter`).
  Then `task lock && task audit`. Surface it to the owner.

## Known gotchas

- `vite build` ships type errors silently — always run `task typecheck` too.
- nginx serves `index.html` (200) for missing images — only `/assets/` hard-404s.
- `BASE_PATH` env drives the base for the GitHub Pages workflow; local/Cloud
  Run use `/`. Use `withBase`/`withBaseHtml` (`src/lib/asset.ts`) for asset
  URLs in code.
- A host `node_modules/` is an empty mount stub — safe to delete, don't
  populate it.
- **Committing/shipping:** never commit automatically — ask the owner first
  (see SKILL.md "Committing & shipping"). When confirmed, commit on `main` with
  a Conventional-Commits message (`feat:`/`fix:`/`docs:`/`content:`/…) and
  `git push origin main`. **The push is a deploy:** `deploy-pages.yml` builds
  and publishes to GitHub Pages on every push to `main`. Don't watch or verify
  the Pages run afterward (trust it — local typecheck + build is the gate); only
  inspect the workflow if the owner reports a problem or you edited the workflow
  file. Feature branches + PRs are the planned future flow, not yet active.

## The dev roadmap (in priority order — from `/roadmap`)

1. **Build-time prerendering** of every route to static HTML — the keystone:
   unlocks real SEO, Open Graph, Pinterest Rich Pins. All routes are knowable
   at build time (content glob + static pages), so a Vite prerender pass fits.
2. Per-page `<title>` + meta description (cheap interim: `document.title` on
   route change).
3. `sitemap.xml` generated from `content/` at build time (`public/robots.txt`
   already has a commented Sitemap line awaiting the domain).
4. Privacy-friendly cookieless analytics (update `/privacy` first).
5. `/go/<slug>` affiliate redirect service with click counting — check each
   program's cloaking policy (Amazon forbids it; raw links there).

When you complete one of these, tick it on `content/locales/en/pages/roadmap.md`.
