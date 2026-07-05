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
| **Sidebar** (About, Mission & Values, almanac) | `src/components/Sidebar.tsx` `PANELS` registry + `.side-panel*`/`.side-tab*`/`.side-about*`/`.side-mission`/`.value-badge*` | Each `site.yaml` `sidebar:` entry is a **collapsible panel** (flat rectangular toggle). Types: `about` (the linked page's frontmatter `image` + site `description` blurb + link to `/about`, open by default), `missionValues` (mission + values combined, collapsed by default), `almanac` (open by default; label = `sidebar.title`). Desktop = vertical stack of panels; **≤900px** the rail rides to the top (`order:0`) and renders as a `SidebarMobile` tab-row (one open at a time, all start closed). Breakpoint via `useIsNarrow` (matchMedia, kept in sync with the 900px CSS). **Route tie-in:** `SidebarMobile` watches `useLocation().pathname` and, on `/support`, auto-opens the `about` tab so its family photo shows above the donation ask (effect keyed on pathname only, so the visitor can still close it and other pages stay closed). Desktop already shows About open by default, so this is mobile-only. Value icons: `VALUE_ICONS` map + `icon:` on each value. |
| Almanac calendar / astrology | `src/components/AstroCalendar.tsx` + `src/lib/astro.ts` (math/glyphs) + `src/lib/astroText.ts` (all wording, per locale) | Real ephemeris — extend generators, never a horoscope API. `eventsForMonth(y, m, locale)` is locale-aware; event titles/blurbs/body+sign+aspect names come from `astroText.ts` (RU is serious Daragan-style with proper sign case forms). Times/day-bucketing are the viewer's local timezone (not location-aware — see CLAUDE.md). |
| Reviews / guides / pages content | `content/locales/<lng>/…` | Markdown+YAML; see `content-editing.md`. Guides live in per-epic subfolders (`guides/founder-guide/`, `guides/homeopathy/`, `guides/herbalism/`, `guides/trophology/`, `guides/inside-websites/`) — organizational only, `content.ts` globs `guides/**/*.md` and the slug is always just the filename. |
| Site name, tagline, mission, values, nav, social, production URL | `content/locales/<lng>/site.yaml` | Per locale; shape in `SiteConfig` (`lib/types.ts`). `url:` is the current GitHub Pages subpath, reference-only until the site moves to a custom domain root. **`getSite(locale)` shallow-merges `en` as a base**, so a locale's fields win but anything it omits falls back to English — non-localized blocks (e.g. `support:`) are authored once in `en/site.yaml` and inherited (DRY). Don't duplicate non-localized config into `ru/site.yaml`. |
| UI chrome strings (labels, aria) | `src/locales/en.ts` + `ru.ts` | Flat `t()` dictionary; keep both in sync. |
| Colors, radii, layout, breakpoints | `src/styles.css` | One stylesheet; CSS vars in `:root`. Breakpoints: 900 (sidebar stacks; guide TOC also collapses here), 820 (nav→hamburger), 720/560/480. |
| **Guide tables & SVG diagrams** | tables authored inline in the guide markdown; **diagram geometry in shared templates** `content/shared/diagrams/<name>.svg`, embedded per locale via a <code>\`\`\`diagram &lt;name&gt;</code> fenced block; renderer = `renderDiagram` + a `marked` `renderer.code` override in `src/lib/content.ts`; styled by `.prose table` + `.prose figure.diagram` in `styles.css` | Template SVG carries `{{slot}}` tokens (`{{aria}}`, `{{t1}}…{{tN}}`/named slots, `{{caption}}`); the fenced block's YAML supplies each locale's text. Renderer HTML-escapes values, suffixes SVG ids per instance (marker ids never collide), wraps in `<figure class="diagram">` + `<figcaption>`, and renders a visible `⚠` figcaption (never throws) on a bad template/slot. Geometry lives once for all locales → geometry edits touch one file; text edits are per-locale slot values. SVGs color themselves with palette CSS vars (re-theme automatically); tables get the card look + horizontal scroll ≤720px. Authoring rules + overflow audit + parity checks in `content-editing.md` "Visuals inside guides". |
| Cards (product/guide) | `src/components/ProductCard.tsx` / `GuideCard.tsx` + `.card`/`.card-link`/`a.tag` in `styles.css` | **Whole card is clickable** via a stretched-link overlay: the title `<Link className="card-link">` paints a full-card `::after` (needs `.card { position: relative }`). Genuinely interactive children are raised above it (`.card-body a.tag { z-index: 2 }`). Media is a plain `<div>` now (not a second link). Grids collapse to 1 col on mobile. `GuideCard` is only used for the homepage "New on the Compass" teaser now — the `/guides` epic listing uses `GuideRow` instead (see below). |
| Review category tag → filtered list | `ProductCard.tsx` tag `<Link>` → `Reviews.tsx` `useSearchParams` | The category chip links to `/reviews?category=<cat>`; `Reviews.tsx` reads the `category` param (validated against known categories, else `All`) so the tag filters from any page, incl. Home. Guide cards use a plain `<span>` tag (no guide taxonomy) so their whole card just navigates. |
| **Upcoming reviews ("in the works" rail)** | `src/components/UpcomingReviews.tsx` + `.upcoming*`/`.reviews-layout`/`.reviews-main` in `styles.css`; data in `site.yaml` `upcoming:` | Flat rectangle list in a **right-hand rail** on `/reviews` — the public queue of reviews bought/planned but not written. `Reviews.tsx` wraps the filters + product grid (`.reviews-main`) and the `<UpcomingReviews>` aside in a `.reviews-layout` grid (`1fr` + `clamp(240px,24vw,300px)`), mirroring the guide detail article/TOC split; the page header (title + lead) stays full-width above. On desktop the rail is `position: sticky` (top 84px); **≤900px** the layout becomes a flex column and the rail rides above the grid (`order:-1`), still right under the subtitle. Entries are faintly greyed (`rgba(47,44,39,.05)`) so they don't read as live review cards. Each entry is `{ name, url }` (`UpcomingItem` in `lib/types.ts`); the whole rectangle links out to the product listing (Amazon, for now) in a new tab. **Not a review:** no rating, no verdict, no `rel=sponsored` affiliate tag — the note (`reviews.upcomingNote`) says so. Labels are UI strings (`reviews.upcomingTitle`/`upcomingNote`); brand/product names stay identical across locales (do-not-translate). Add/remove a queued item = edit `upcoming:` in **both** `en` and `ru` `site.yaml`; delete an entry when its real review ships. |
| **Guide rows (epic listing)** | `src/components/GuideRow.tsx` + `.guide-row*` in `styles.css` | Fat horizontal bars (175px tall, full-bleed image) instead of the vertical `GuideCard` grid — corner-anchored labels: "Guide" tag top-left, chapter number top-right (no date shown), title bottom-left, excerpt bottom-right (2-line clamp). **The row itself is the `<Link>`** (not a nested `.card-link` on the title) — the title sits in `.guide-row-title`, which is `position: absolute` for corner placement, so a `.card-link::after` nested inside it would take *that* as its containing block and shrink the click target down to the title's own small box instead of the full row (see `.side-about` for the same "outer element is the link" pattern). Title/excerpt text is white with a hard black outline (layered `text-shadow`, `.guide-row-title, .guide-row-excerpt`) for legibility over busy AI-art thumbnails, over a bottom-heavy dark gradient (`.guide-row::before`) for extra contrast. `Guides.tsx` renders them in a `.guide-row-list` (flex column, full width) instead of a `.grid`. **≤640px:** height goes to `min-height` (text can grow the box), excerpt hidden, title spans full width. |
| **Compass section / epics (courses)** | `src/pages/Guides.tsx` + `.epic-strip`/`.epic-thumb*`/`.epic-blurb` in `styles.css`; config in `site.yaml` `epics:` | The Guides section is user-facing **"Compass" / "Путь"** (nav label + `guides.title`) — deliberately not "Guides"/"Courses"/"Learn" in visible copy — framed as course-like collections, but the **route + content dir stay `/guides`** (internal). Epic thumbnails act as tabs; the row list below shows guides whose **first tag** equals the selected epic's `tag`, with the epic's `blurb` shown as a course intro. First epic = default. Membership is data (first tag); display metadata (title, image, blurb) is `site.yaml` `epics:` (`GuideEpic` in `lib/types.ts`). The word "Epic" never appears in UI. Within the visible list, guides with an optional `chapter: N` frontmatter number sort ascending (course order) ahead of un-chaptered ones, which keep date-desc — see "Guide chapter ordering" below. |
| **Guide chapter ordering** | `chapter?: number` on `Guide` (`lib/types.ts`); sort in `Guides.tsx`; label in `GuideRow.tsx` (epic listing), `GuideCard.tsx` (homepage teaser) + `GuideDetail.tsx` via `t('guides.chapter', { n })` | Optional frontmatter field for course-like epics — every course epic uses it (founder-guide got `chapter:` 1–5 in the 2026-07-05 course retrofit; trophology is `chapter:` 1–5). `Guides.tsx` sorts the epic-filtered list: chaptered guides ascending by `chapter`, before/apart from un-chaptered ones (which keep the existing date-desc order — a stable sort). All three surfaces show a "Chapter N" / «Глава N» tag when `chapter` is present. |
| **Guide detail table of contents (TOC)** | `src/components/TableOfContents.tsx` + `.detail-layout`/`.detail-nav`/`.toc*` in `styles.css`; heading ids stamped by a custom `marked` renderer in `src/lib/content.ts` (`headingIdRenderer`) | A **page-local** nav distinct from the site-wide left rail (`Sidebar.tsx`) — it lives inside `GuideDetail.tsx`'s own `.detail-layout` grid, not the app-level `.layout-grid`, so the two rails never compete for the same space. `.detail-layout` uses `grid-template-areas` with **four** regions — `nav` (the back-link + tags, `.detail-nav`, spans full width), `header` (`.detail-header`: title + date + hero image, split out of the `<article>` so the TOC can sit *below* the image), `article` (the markdown body), `toc` — laid out `nav`/`nav`, `header`/`toc`, `article`/`toc`, so the back-link spans the top and the TOC is a sticky right column beside header+body on desktop. (Review detail pages have no TOC, so they keep title/image inside `.detail`; the `.detail h1` / `.detail-image` rules are shared with `.detail-header` via grouped selectors + `.detail-header .detail-image { margin-bottom: 0 }` since the grid row-gap already spaces it.) Built by parsing the guide's already-rendered HTML for `h2[id]`/`h3[id]` (`DOMParser`, no runtime markdown re-parse) — h3s nest under the preceding h2 visually via indent only (flat list, not a real tree). Renders **nothing** below 3 headings. Scrollspy (`IntersectionObserver`, recomputed from `getBoundingClientRect()` against a fixed "read line" under the sticky header) highlights the current heading. Desktop: sticky column, always expanded (`.toc-toggle` hidden). **≤900px** (same breakpoint as the site-wide sidebar): `.detail-layout` becomes a flex column ordered `.detail-nav` → `.detail-header` (title + image) → `.toc` → article body, and the TOC is a native `<details open>`/`<summary>` block **expanded by default** (still collapsible by tapping the summary), styled like the sidebar's `.side-tab`. Heading ids: `slugify()` transliterates Cyrillic to ASCII (е→e, ж→zh, etc.) then dashes non-alphanumerics, deduping repeats per document (`section`, `section-2`, …) — so RU headings still get stable, readable, scrollable anchors. |
| **Mandala SVG art** | `scripts/generate-mandala.mjs` | Generates the radial-symmetry "mandala" images used for guide chapters and product reviews (gradient background + rotated petal ring, generated; center icon per item, hand-authored markup in config) — see CLAUDE.md > Images. `SETS` holds one named config per content type: `guides` (new chapters — inside-websites 1–5 and trophology 1–5; the original 11 homeopathy/herbalism/founder chapters predate this script and are hand-authored, untouched by it), `epics` (the per-course thumbnails for the Compass strip) and `reviews` (all 6 current products). Add a new set by adding a `SETS` key. Run via `task mandalas SET=<name>` (optional `ONLY=slug1,slug2`); output is `public/images/<prefix>-<slug>.svg`. Wire the result into frontmatter `image:` by hand, same as any image. |
| Routes | `src/App.tsx` | Standalone pages need a route here. |
| **Copy-to-clipboard button** | `src/components/CopyButton.tsx` + `.copy-btn` in `styles.css` + `copy.*` UI strings | Reusable: `<CopyButton value={text} className? ariaLabel? />`. Shows a brief check + localized "Copied" state (sage). Tries the async Clipboard API, falls back to a hidden-textarea `execCommand` (covers insecure-context / permission-denied / sandboxed-iframe). Generic look in `.copy-btn`; the **caller positions it** (e.g. `.crypto-copy` parks it at the right edge of a wallet address and reveals it on `.crypto-addr-wrap:hover` / `:focus-visible`, staying visible on touch via `@media (hover: hover)`). Reach for this for any copyable field (wallet addresses today; emails, referral/affiliate links, etc. later). |
| **Support / donation page** | `src/pages/Support.tsx` (dedicated page, **not** `MarkdownPage`) + `support:` block in `content/locales/en/site.yaml` + `support.*` UI strings in `src/locales/*.ts` + intro prose in `pages/support.md` + `.support-*`/`.crypto-*`/`.support-thanks` in `styles.css`; route in `App.tsx`; nav item in `site.yaml` | Donation page, last item in the primary `nav:`. **Config-driven (DRY):** the payment methods render from the `support:` block (`SupportConfig` in `types.ts`) — `stripe` (a Payment Link URL; absent → "coming soon" `.support-btn-soon`), `paypal` (paypal.me handle → `.support-btn-paypal`; absent → card hidden), and `crypto[]` (`{coin, network, address}` → `.crypto-*` rows; empty → card hidden). Payment values are **non-localized: authored once in `en/site.yaml`**, and `ru/site.yaml` has **no** `support:` block — it inherits via `getSite`'s en-base merge (single source for wallet addresses). Visible labels come from `support.*` UI strings (keep en/ru in sync); the intro paragraph stays in `pages/support.md` (content-as-data) and the closing line is `t('support.thanks')`. Each wallet address gets a reusable `<CopyButton>` (revealed on row hover; see the Copy-to-clipboard row). Wallet addresses + PayPal handle are `PASTE-YOUR-…` placeholders — grep `PASTE-YOUR` and fill before shipping, and **always quote address/handle values** in the YAML (an unquoted `0x…` ETH address is parsed as a hex number and corrupted). **Mobile sidebar tie-in:** on `/support`, `SidebarMobile` auto-opens the `about` tab (family photo → warmer ask) — see the Sidebar row. |
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
  **Epic courses (5 or 11 chapters):** the full authoring blueprint (curriculum
  architecture, the «Нить»/Thread navigation weave, chapter anatomy, shipping
  checklist) is `context/epic-writing-context.md` — read it before writing any
  course. Chapters are guides with `chapter: N` frontmatter (orders them 1→N
  inside the epic) and the epic tag first. Per-course outlines live in
  `context/course-plan-<slug>.md` (existing: building-in-public, homeopathy,
  herbalism, inside-websites, trophology).
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
