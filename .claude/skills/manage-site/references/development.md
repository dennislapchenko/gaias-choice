# Development — Gaia's Choice

Stack: Vite 6 + React 18 + TS (strict), `react-router-dom` BrowserRouter,
single hand-written `src/styles.css`, content bundled at build time via
`import.meta.glob` in `src/lib/content.ts`. The site is static-first: an
**optional** Go backend sidecar (`backend/`) adds progressive-enhancement
features, but the static site works identically when it's absent (which is
most of the time). Architecture details live in the repo `CLAUDE.md` — read it
before structural changes.

## Where things live (change X → edit Y)

Keep this table current — when you add/rename/change a component, update the row
(that's a house rule; see SKILL.md "Update the docs").

| To change… | Edit | Notes |
| --- | --- | --- |
| Page shell: header, nav, **mobile hamburger menu**, footer | `src/components/Layout.tsx` + `.site-header`/`.nav-toggle`/`.site-nav` in `styles.css` | Nav collapses to a hamburger dropdown ≤820px (closes on nav/Escape/outside-click). Nav items come from `site.yaml` `nav:`/`footerNav:`. |
| **Language switcher** | `src/components/LanguageSwitcher.tsx` + `.lang-toggle`/`.lang-flag` in `styles.css` | Flag-emoji button that cycles locale on click (no menu). Flags in `LOCALE_FLAGS` (`lib/i18n.tsx`). On hover the displayed flag swaps to the *next* locale's flag (a `hovered` state on the button toggles which flag renders); reverts on `mouseleave`. No tooltip/chip. |
| **Theme/palette switcher** | `src/components/ThemeSwitcher.tsx` + `.theme-*` | Dropdown; palettes are data in `content/themes.yaml` (`lib/theme.ts` applies them). Each option shows swatches + the **label only** (not the `tag` id / "· default"). |
| **Sidebar** (About, Mission & Values, Respected, almanac) | `src/components/Sidebar.tsx` `PANELS` registry + `.side-panel*`/`.side-tab*`/`.side-about*`/`.side-mission`/`.value-badge*`/`.respected-*` | Each `site.yaml` `sidebar:` entry is a **collapsible panel** (flat rectangular toggle). Types: `about` (the linked page's frontmatter `image` + site `description` blurb + link to `/about`, open by default), `missionValues` (mission + values combined, collapsed by default), `respected` (collapsed by default; the teachers behind the worldview from `site.yaml` `respected:` — rendered as a **cloud of surname chips over ONE detail card** (nine people as a flat list would swamp the rail): clicking a chip swaps the card (name/bio/why, the `why` an italic left-ruled quote), and when a person has `url:` the whole card is an outbound `<a target="_blank">` capped by the `sidebar.respectedVisit` line. **Names are never translated** — same original spelling in every locale (which also keeps chip/state keys locale-stable); **the list mirrors `context/ideology-context.md`** — same people, same order, keep in sync when adding an influence), `almanac` (open by default; label = `sidebar.title`). Desktop = vertical stack of panels; **≤900px** the rail rides to the top (`order:0`) and renders as a `SidebarMobile` tab-row (one open at a time, all start closed). Breakpoint via `useIsNarrow` (matchMedia, kept in sync with the 900px CSS). **Route tie-in:** `SidebarMobile` watches `useLocation().pathname` and, on `/support`, auto-opens the `about` tab so its family photo shows above the donation ask (effect keyed on pathname only, so the visitor can still close it and other pages stay closed). Desktop already shows About open by default, so this is mobile-only. Value icons: `VALUE_ICONS` map + `icon:` on each value. |
| **Double-sidebar pages** (wide-screen widen + rail dimming) | `styles.css`: `.layout-grid:has(.toc, .upcoming, .epic-rail)` / `.detail-layout:has(.toc)` | Any page where the site-wide left `.sidebar` shares `.layout-grid` with a second rail — the entry-detail `.toc` (Compass chapters/Journal entries with 3+ headings), the Reviews/Journal `.upcoming` "in the works" rail, or the Compass `.epic-rail` course picker — gets two treatments, all scoped by `:has()` so single-sidebar pages (Home, `.detail` without a TOC) are untouched: at `≥1300px` the container widens from `1180px` to `1600px` (`.reviews-main`'s `1fr` column grows for free; `.detail-layout`'s article track is bumped explicitly from `760px` to `960px`); at all widths every rail sits at `opacity: 0.6` until hovered/focused-within (`:is(.sidebar, .toc, .upcoming, .epic-rail)`, each independently), so the central column reads as the visual focus. |
| Almanac calendar / astrology | `src/components/AstroCalendar.tsx` + `src/lib/astro.ts` (math/glyphs) + `src/lib/astroText.ts` (all wording, per locale) | Real ephemeris — extend generators, never a horoscope API. `eventsForMonth(y, m, locale)` is locale-aware; event titles/blurbs/body+sign+aspect names come from `astroText.ts` (RU is serious Daragan-style with proper sign case forms). Times/day-bucketing are the viewer's local timezone (not location-aware — see CLAUDE.md). |
| Reviews / Compass / Journal / pages content | `content/locales/<lng>/…` | Markdown+YAML; see `content-editing.md`. **Compass** chapters live in per-epic subfolders (`compass/founder-guide/`, `compass/homeopathy/`, `compass/herbalism/`, `compass/trophology/`, `compass/inside-websites/`) — organizational only, `content.ts` globs `compass/**/*.md`, slug = filename. **Journal** entries are flat (`journal/*.md`, globbed `journal/*.md`). |
| Site name, tagline, mission, values, nav, social, production URL | `content/locales/<lng>/site.yaml` | Per locale; shape in `SiteConfig` (`lib/types.ts`). `url:` is the current GitHub Pages subpath, reference-only until the site moves to a custom domain root. **`getSite(locale)` shallow-merges `en` as a base**, so a locale's fields win but anything it omits falls back to English — locale-identical fields are authored once in `en/site.yaml` and omitted from other locales (the canonical field list lives in `content/locales/README.md`; don't copy them back into `ru/site.yaml`). The merge is shallow: a locale overriding a list (e.g. `epics:`) states it in full. |
| UI chrome strings (labels, aria) | `src/locales/en.ts` + `ru.ts` | Flat `t()` dictionary; keep both in sync. |
| Colors, radii, layout, breakpoints | `src/styles.css` | One stylesheet; CSS vars in `:root`. Breakpoints: 900 (sidebar stacks; entry TOC + Journal year-rail also collapse here), 820 (nav→hamburger), 720/560/480. |
| **Guide tables & SVG diagrams** | tables authored inline in the guide markdown; **diagram geometry in shared templates** `content/shared/diagrams/<name>.svg`, embedded per locale via a <code>\`\`\`diagram &lt;name&gt;</code> fenced block; renderer = `renderDiagram` + a `marked` `renderer.code` override in `src/lib/content.ts`; styled by `.prose table` + `.prose figure.diagram` in `styles.css` | Template SVG carries `{{slot}}` tokens (`{{aria}}`, `{{t1}}…{{tN}}`/named slots, `{{caption}}`); the fenced block's YAML supplies each locale's text. Renderer HTML-escapes values, suffixes SVG ids per instance (marker ids never collide), wraps in `<figure class="diagram">` + `<figcaption>`, and renders a visible `⚠` figcaption (never throws) on a bad template/slot. Geometry lives once for all locales → geometry edits touch one file; text edits are per-locale slot values. SVGs color themselves with palette CSS vars (re-theme automatically); tables get the card look + horizontal scroll ≤720px. Authoring rules + overflow audit + parity checks in `content-editing.md` "Visuals inside guides". |
| Cards (product/compass) | `src/components/ProductCard.tsx` / `CompassCard.tsx` + `.card`/`.card-link`/`a.tag` in `styles.css` | **Whole card is clickable** via a stretched-link overlay: the title `<Link className="card-link">` paints a full-card `::after` (needs `.card { position: relative }`). Genuinely interactive children are raised above it (`.card-body a.tag { z-index: 2 }`). Media is a plain `<div>` now (not a second link). Grids collapse to 1 col on mobile. `CompassCard` is only used for the homepage "New on the Compass" teaser now — the `/compass` epic listing uses `CompassRow` instead (see below). |
| Review category tag → filtered list | `ProductCard.tsx` tag `<Link>` → `Reviews.tsx` `useSearchParams` | The category chip links to `/reviews?category=<cat>`; `Reviews.tsx` reads the `category` param (validated against known categories, else `All`) so the tag filters from any page, incl. Home. Guide cards use a plain `<span>` tag (no guide taxonomy) so their whole card just navigates. |
| **Upcoming ("in the works" rail — Reviews + Journal)** | `src/components/Upcoming.tsx` + `.upcoming*`/`.reviews-layout`/`.reviews-main` in `styles.css`; data in `site.yaml` `upcoming:` (reviews) / `upcomingJournal:` (journal) | Flat rectangle list in the **right-hand rail** of `/reviews` AND `/journal` — the public queue of things bought/planned but not written. Both pages wrap their main column (`.reviews-main`) and the `<Upcoming>` aside in the same `.reviews-layout` grid (`1fr` + `clamp(240px,24vw,300px)`); the page header stays full-width above. On desktop the rail is `position: sticky` (top 84px); **≤900px** the layout becomes a flex column and the rail rides above the content (`order:-1`), still right under the subtitle. Entries are faintly greyed (`rgba(47,44,39,.05)`) so they don't read as live cards. Each entry is `{ name, url? }` (`UpcomingItem` in `lib/types.ts`): with `url` the rectangle links out in a new tab (reviews → Amazon listing; hover feedback is `a.upcoming-link` only); without it it's a plain span (journal ideas). Title/note are **props** — each page passes its own strings (`reviews.upcomingTitle`/`upcomingNote`, `journal.upcomingTitle`/`upcomingNote`). The rail also hosts the **"Contribute!" copy-template button** at its bottom, below the list, via the optional `contribute: { value, label }` prop (see the "Contribute!" row); with `contribute` set the rail renders even when `items` is empty. Product names stay identical across locales (do-not-translate), so `upcoming:` lives in `en/site.yaml` **only** (other locales inherit it via `getSite`); journal idea titles ARE localized (prose), so `upcomingJournal:` is edited in **both** locales. Delete an entry when the real review/entry ships. See the **Double-sidebar pages** row for the wide-screen widen + dimming this rail shares with the entry-detail TOC. |
| **Compass rows (epic listing)** | `src/components/CompassRow.tsx` + `.guide-row*` in `styles.css` (class names kept `guide-row*`) | Fat horizontal bars (175px tall, full-bleed image) instead of the vertical `CompassCard` grid — corner-anchored labels: "Guide" tag top-left, chapter number top-right (no date shown), title bottom-left, excerpt bottom-right (2-line clamp). **The row itself is the `<Link>`** (not a nested `.card-link` on the title) — the title sits in `.guide-row-title`, which is `position: absolute` for corner placement, so a `.card-link::after` nested inside it would take *that* as its containing block and shrink the click target down to the title's own small box instead of the full row (see `.side-about` for the same "outer element is the link" pattern). Title/excerpt text is white with a hard black outline (layered `text-shadow`, `.guide-row-title, .guide-row-excerpt`) for legibility over busy AI-art thumbnails, over a bottom-heavy dark gradient (`.guide-row::before`) for extra contrast. `Compass.tsx` renders them in a `.guide-row-list` (flex column, full width) instead of a `.grid`. **≤640px:** height goes to `min-height` (text can grow the box), excerpt hidden, title spans full width. |
| **Landing page (`/`) composition** | `src/pages/Home.tsx` | Hero (`.hero`/`.hero-actions`: **three** buttons — Compass primary, Journal + Reviews ghost; labels `home.readGuides`/`home.readJournal`/`home.browseReviews`) then three sections in nav-agnostic order: featured reviews (3 `ProductCard`), **fresh Journal entries** (3 `JournalRow` in a `.journal-list`, hidden when empty; `home.latestJournal`/`home.allJournal`), new Compass entries (2 `CompassCard`). |
| **Journal list + year filter** | `src/pages/Journal.tsx` + `src/components/JournalRow.tsx` + `.journal-list`/`.journal-row*` in `styles.css` (layout classes shared with Reviews: `.reviews-layout`/`.reviews-main`/`.filters`/`.chip`) | The `/journal` listing, **deliberately the same shell as `/reviews`**: copy-template button, then **year filter chips** (`.filters`/`.chip`, an "All" chip + one per distinct entry year desc) in the same spot Reviews has category chips, then the list; the `.upcoming` rail on the right (see the Upcoming row). The active year lives in the URL (`?year=`, validated, `replace: true`) exactly like Reviews' `?category=`. `JournalRow` is a plain **text row (no thumbnail)** — muted date, title, 2-line-clamped excerpt; the whole row is the `<Link to={/journal/<slug>}>`. Entries sort date-desc (`content.ts`). |
| **"Contribute!" copy-template buttons (Journal + Reviews)** | rendered by `Upcoming.tsx` (bottom of the "in the works" rail, below the list) from the `contribute: { value, label }` prop each page passes (`src/pages/Journal.tsx` / `Reviews.tsx`); template sources `content/shared/<kind>-template.<locale>.md` → generic loader + `getJournalTemplate` / `getReviewTemplate` in `content.ts`; `.copy-template-btn` + `.copy-btn-label` in `styles.css`; labels `journal.templateBtn` / `reviews.templateBtn` | Copies a blank markdown scaffold to the clipboard for the owner to start a new entry/review. **Single source:** one raw template per kind+locale under `content/shared/` (en fallback), globbed `*-template.*.md`. The review template is the **canonical universal review structure** (see `content-editing.md` "Add a product review"). `CopyButton`'s optional `label` prop → labelled action button (icon + text, swaps to "Copied"); icon-only stays the default (wallets). **New template kind:** add `content/shared/<kind>-template.en.md` (+`ru`), a thin `get<Kind>Template` wrapper, and a labelled `CopyButton` where it belongs. |
| **Compass section / epics (courses)** | `src/pages/Compass.tsx` + `.epic-rail`/`.epic-row*`/`.epic-blurb`/`.compass-provenance` in `styles.css`; config in `site.yaml` `epics:` | The Compass section is user-facing **"Compass" / "Путь"** (nav label + `compass.title`); **route + content dir are `/compass`**. Under the page header sits the **`compass.provenance` banner** — the "openly computer-assisted" disclosure (the provenance contract is SKILL.md non-negotiable #6). The page body reuses the Reviews/Journal shell (`.reviews-layout`/`.reviews-main`): the chapter list is the main column, and the epic picker is a right-hand rail (`.epic-rail`, styled and positioned like `.upcoming` — see the Upcoming and Double-sidebar pages rows) — small square thumbnail + title rows acting as tabs, active one sage-filled. The row list shows chapters whose **first tag** equals the selected epic's `tag`, with the epic's `blurb` as a course intro above the list. First epic = default. Membership is data (first tag); display metadata (title, image, blurb) is `site.yaml` `epics:` (`GuideEpic` in `lib/types.ts`). The word "Epic" never appears in UI. Within the list, chapters with an optional `chapter: N` sort ascending (course order) ahead of un-chaptered ones, which keep date-desc — see "Compass chapter ordering" below. |
| **Compass chapter ordering** | `chapter?: number` on `CompassEntry` (`lib/types.ts`); sort in `Compass.tsx`; label in `CompassRow.tsx` (epic listing), `CompassCard.tsx` (homepage teaser) + `EntryDetail.tsx` via `t('compass.chapter', { n })` | Optional frontmatter field for course-like epics — every course epic uses it. `Compass.tsx` sorts the epic-filtered list: chaptered entries ascending by `chapter`, before/apart from un-chaptered ones (which keep the existing date-desc order — a stable sort). All three surfaces show a "Chapter N" / «Глава N» tag when `chapter` is present. Journal entries share `EntryDetail` but never show a chapter tag (`kind="journal"`). |
| **Entry detail table of contents (TOC)** — Compass + Journal | `src/components/TableOfContents.tsx` + `.detail-layout`/`.detail-nav`/`.toc*` in `styles.css`; heading ids stamped by a custom `marked` renderer in `src/lib/content.ts` (`headingIdRenderer`) | A **page-local** nav distinct from the site-wide left rail (`Sidebar.tsx`) — it lives inside `EntryDetail.tsx`'s own `.detail-layout` grid (the shared detail component for both Compass chapters and Journal entries), not the app-level `.layout-grid`, so the two rails never compete for the same space. `.detail-layout` uses `grid-template-areas` with **four** regions — `nav` (the back-link + tags, `.detail-nav`, spans full width), `header` (`.detail-header`: title + date + hero image, split out of the `<article>` so the TOC can sit *below* the image), `article` (the markdown body), `toc` — laid out `nav`/`nav`, `header`/`toc`, `article`/`toc`, so the back-link spans the top and the TOC is a sticky right column beside header+body on desktop. (Review detail pages have no TOC, so they keep title/image inside `.detail`; the `.detail h1` / `.detail-image` rules are shared with `.detail-header` via grouped selectors + `.detail-header .detail-image { margin-bottom: 0 }` since the grid row-gap already spaces it.) Built by parsing the entry's already-rendered HTML for `h2[id]`/`h3[id]` (`DOMParser`, no runtime markdown re-parse) — h3s nest under the preceding h2 visually via indent only (flat list, not a real tree). Renders **nothing** below 3 headings. Scrollspy (`IntersectionObserver`, recomputed from `getBoundingClientRect()` against a fixed "read line" under the sticky header) highlights the current heading. Desktop: sticky column, always expanded (`.toc-toggle` hidden). **≤900px** (same breakpoint as the site-wide sidebar): `.detail-layout` becomes a flex column ordered `.detail-nav` → `.detail-header` (title + image) → `.toc` → article body, and the TOC is a native `<details open>`/`<summary>` block **expanded by default** (still collapsible by tapping the summary), styled like the sidebar's `.side-tab`. Heading ids: `slugify()` transliterates Cyrillic to ASCII (е→e, ж→zh, etc.) then dashes non-alphanumerics, deduping repeats per document (`section`, `section-2`, …) — so RU headings still get stable, readable, scrollable anchors. See the **Double-sidebar pages** row for the wide-screen widen + rail-dimming treatment this rail shares with the Upcoming rail. |
| **Mandala SVG art** | `scripts/generate-mandala.mjs` | Generates the radial-symmetry "mandala" images used for guide chapters and product reviews (gradient background + rotated petal ring, generated; center icon per item, hand-authored markup in config) — see CLAUDE.md > Images. `SETS` holds one named config per content type: `guides` (new chapters — inside-websites 1–5 and trophology 1–5; the original 11 homeopathy/herbalism/founder chapters predate this script and are hand-authored, untouched by it), `epics` (the per-course thumbnails for the Compass strip) and `reviews` (all 6 current products). Add a new set by adding a `SETS` key. Run via `task mandalas SET=<name>` (optional `ONLY=slug1,slug2`); output is `public/images/<prefix>-<slug>.svg`. Wire the result into frontmatter `image:` by hand, same as any image. |
| Routes | `src/App.tsx` | Standalone pages need a route here. |
| **Backend API client** | `src/lib/api.ts` (the whole FE↔BE contract) + `src/components/BackendBadge.tsx` (invisible-when-down consumer, mounted in `Layout.tsx` footer) + `backend.connected` UI string | `api.ts` = `apiGet`/`apiPost`/`ApiError` + a `useApi<T>(path)` hook + request/response types (e.g. `HelloResponse`). Base URL = `VITE_API_URL` (set by the compose dev loop / ngrok) **else** same-origin `/api` (the single-container future). **Degradation rule:** every helper fails quietly — consumers render null on error, never an error page. Two guards keep the live Pages site silent: a **content-type guard** (an HTML-200 SPA-fallback response is treated as "backend unavailable", never data) and the ngrok `ngrok-skip-browser-warning` header. Adding a BE feature = new type + hook call + a consumer that renders null without data. |
| **Go backend sidecar** | `backend/` (Go/gin, own `Dockerfile` + `go.mod`) — `main.go` (config from env, routes), `store.go` (SQLite + embedded migration runner), `migrations/*.sql`, `cors.go` (hand-written allowlist) | API-only, port **8787**, under `/api`. Endpoints today: `/api/healthz`, `/api/hello` (proves a DB round-trip). SQLite at `${DATA_DIR}/gaia.db` (WAL), git-ignored `backend/data/`. Real schema (users/pages) is the portal plan, not here. Run via `task be:dev` (BE-only) or `task dev` (FE+BE). |
| **Deploy stack (VM, live)** | `deploy/compose.yaml` (api behind Caddy) + `deploy/Caddyfile` + `deploy/infra-log.md` (provisioning record + redeploy steps) + `.github/workflows/build-backend.yml` (GHCR image build) + `.doco-cd.yml`/`deploy/README.md` (doco-cd GitOps, deferred) | The backend runs on a Hetzner VM (AlmaLinux, Helsinki), Caddy terminating TLS at `gaias-choice.gardenofatlantis.com`. First deploy is **manual `docker compose`** (image pinned via `BE_TAG`); doco-cd auto-redeploy is prepared but not yet activated. To redeploy or back up, follow `deploy/infra-log.md`. **Never deploys the static site** — that stays on Pages. |
| **Per-route `<title>` + meta description** | `src/lib/head.tsx` (`usePageHead` hook + `PageHead` component); called by every page in `src/pages/` | Client-side interim until prerendering bakes real per-route heads (`context/seo/seo-paths.md`) — crawlers still see `index.html`'s static head; this covers tabs/bookmarks/history. Title = `"<page> — <site name>"`, home = `"<name> — <tagline>"`; description = page-specific (frontmatter `excerpt`, section lead string) or the site description as fallback. `PageHead` is the same hook as a null-rendering component, for pages that early-return `<NotFound />` (keeps hook order unconditional) — render it only in the found branch; `NotFound` sets its own head. **New page → call `usePageHead(title, desc?)`** (or render `<PageHead …/>` after an early return). |
| **Copy-to-clipboard button** | `src/components/CopyButton.tsx` + `.copy-btn` in `styles.css` + `copy.*` UI strings | Reusable: `<CopyButton value={text} className? ariaLabel? />`. Shows a brief check + localized "Copied" state (sage). Tries the async Clipboard API, falls back to a hidden-textarea `execCommand` (covers insecure-context / permission-denied / sandboxed-iframe). Generic look in `.copy-btn`; the **caller positions it** (e.g. `.crypto-copy` parks it at the right edge of a wallet address and reveals it on `.crypto-addr-wrap:hover` / `:focus-visible`, staying visible on touch via `@media (hover: hover)`). Reach for this for any copyable field (wallet addresses today; emails, referral/affiliate links, etc. later). |
| **Live-edit: edit mode + git-backed editor** | Gate: `src/lib/editMode.tsx` (`EditModeProvider`/`useEditMode`, outermost in `App.tsx`). Editor: `src/lib/contentEditor.tsx` (`ContentEditorProvider`/`useContentEditor` — `openField`/`openDraft`), mounted above `<Routes>`. Buttons: `src/components/EditButton.tsx` (`icon="pencil"` in-place edit, `icon="plus"` draft). Addresses: `EditRef` in `lib/types.ts`, minted only by provenance getters in `lib/content.ts` (e.g. `getUpcomingEditRef`). BE side: `backend/content.go`. Styles: `.edit-btn`/`.content-editor*` in `styles.css`. `editor.*` UI strings (en+ru). | **Readers never see any of this** — buttons render only in edit mode (`#edit` + valid `ADMIN_TOKEN`; see the gotcha below). `openField({title, ref, onSaved})`: fetches the CURRENT file via `/api/content/file`, shows just the scalar, Save does **CST-level byte-preserving YAML surgery** (`Parser`/`Composer`/`CST.setScalarValue` from the existing `yaml` dep — the Document API re-folds long block scalars; don't switch back) and posts the whole file + sha to `/api/content/save`; 409 ⇒ re-fetch, re-apply, one retry; success shows "published, live in ~2 min" and calls `onSaved` (optimistic UI). `openDraft({title, path, initialValue, message})`: composes a new content file — a pre-flight GET refuses overwriting (404 = good case). Every save is a git commit (`content: … via portal`) → the normal Pages deploy publishes it (~2 min); git stays the only source of truth. **Wired today:** two buttons per `Upcoming` row — ✎ edits the item's name in `site.yaml` (the EditRef knows which locale's file actually supplied the list; RU's inherited `upcoming` edits the **en** file), ＋ drafts `content/locales/<locale>/{products,journal}/<slug>.md` from the contribute template (Cyrillic-aware `slugify`). The anonymous copy-template button is unchanged. |
| **Support / donation page** | `src/pages/Support.tsx` (dedicated page, **not** `MarkdownPage`) + `support:` block in `content/locales/en/site.yaml` + `support.*` UI strings in `src/locales/*.ts` + intro prose in `pages/support.md` + `.support-*`/`.crypto-*`/`.support-thanks` in `styles.css`; route in `App.tsx`; nav item in `site.yaml` | Donation page, last item in the primary `nav:`. **Config-driven (DRY):** the payment methods render from the `support:` block (`SupportConfig` in `types.ts`) — `stripe` (a Payment Link URL; absent → "coming soon" `.support-btn-soon`), `paypal` (paypal.me handle → `.support-btn-paypal`; absent → card hidden), and `crypto[]` (`{coin, network, address}` → `.crypto-*` rows; empty → card hidden). Payment values are **non-localized: authored once in `en/site.yaml`**, and `ru/site.yaml` has **no** `support:` block — it inherits via `getSite`'s en-base merge (single source for wallet addresses). Visible labels come from `support.*` UI strings (keep en/ru in sync); the intro paragraph stays in `pages/support.md` (content-as-data) and the closing line is `t('support.thanks')`. Each wallet address gets a reusable `<CopyButton>` (revealed on row hover; see the Copy-to-clipboard row). Wallet addresses + PayPal handle are `PASTE-YOUR-…` placeholders — grep `PASTE-YOUR` and fill before shipping, and **always quote address/handle values** in the YAML (an unquoted `0x…` ETH address is parsed as a hex number and corrupted). **Mobile sidebar tie-in:** on `/support`, `SidebarMobile` auto-opens the `about` tab (family photo → warmer ask) — see the Sidebar row. |
| **Author voice, family bio & worldview (writing/rephrasing content)** | `context/persona-context.md` (how she sounds + the family's REAL biography — the camper family is not fictional) + `context/ideology-context.md` (what we believe: Health = Chek, Asprey; Worldview = Buhner, Daragan, Ralston; Children = Steiner, Swan — extensible; Health governs food/consumption claims) | Read both before authoring/rephrasing RU content, any "who we are" copy, Compass courses, or Journal entries. |

## Commands (always via Taskfile — never host npm)

| Command | What |
| --- | --- |
| `task typecheck` | strict `tsc --noEmit` — **`task build` does NOT type-check** |
| `task build` | build SPA to `dist/` |
| `task dev` | **FE + BE together** via `compose.dev.yaml`: Vite HMR :5173 + backend with air hot-reload :8787 — **needs a TTY** (foreground compose); Ctrl-C stops both |
| `task be:dev` | backend only, `go run .` on :8787 (`-it`) |
| `task be:test` / `be:tidy` / `be:image` / `be:run` / `be:verify` | vet+test / `go mod tidy && verify` / build distroless image / run prod image :8787 / test+image gate — all containerized (`golang:1.23-alpine`, cache in `gaias-choice-go-cache` volume) |
| `task be:tunnel` | `ngrok http 8787` (host ngrok, as with FE dev) |
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
  `footerNav:` (never hardcode links in `Layout.tsx`). Current content routes:
  `/reviews`+`/reviews/:slug`, `/compass`+`/compass/:slug`, `/journal`+`/journal/:slug`
  (the two `:slug` course/blog routes share `EntryDetail` via a `kind` prop).
- **New Journal entry:** drop a markdown file in `content/locales/<lng>/journal/`
  (`title`, `excerpt`, `date`, optional `tags`/`image`) — no code change, no route
  (`content.ts` globs `journal/*.md`; `/journal` + `/journal/:slug` already exist).
  It lists date-desc on `/journal`, filed under its year in the filter rail. Journal
  is **human-written** (unlike Compass) — real notes only, no fabricated trips; the
  seed `driving-with-a-toddler.md` is an explicit fill-in template. The reusable
  scaffold behind the page's "copy template" button is `content/shared/journal-template.<locale>.md`.
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
  then tag the chapters that belong to it with that `tag` as their **first** tag
  (files go under `content/locales/<lng>/compass/<epic-tag>/`). It appears as a new
  thumbnail in the Compass section automatically; the first `epics:` entry is the
  default selection. No code change (`Compass.tsx` is generic). Ideology: each epic
  should read like a complete, streamlined free course (Fable 5 will author that
  content). Compass is the **openly computer-assisted** section — that's fine and
  disclosed (the `compass.provenance` banner); the same is NOT true of Journal.
  **Epic courses (5 or 11 chapters):** the full authoring blueprint (curriculum
  architecture, the «Нить»/Thread navigation weave, chapter anatomy, shipping
  checklist) is `context/epic-writing-context.md` — read it before writing any
  course. Chapters are markdown files with `chapter: N` frontmatter (orders them
  1→N inside the epic) and the epic tag first. Per-course outlines live in
  `context/course-plan-<slug>.md` (existing: building-in-public, homeopathy,
  herbalism, inside-websites, trophology).
- **New content field:** extend the type in `src/lib/types.ts`, render it in
  the component — `content.ts` spreads frontmatter automatically, no parser
  changes needed.
- **New API endpoint:** if it needs new tables, add a numbered
  `backend/migrations/00N_*.sql` (applied at boot, in order); add a store
  method in `store.go` and a gin handler in `main.go` under `/api`; on the FE
  add the request/response type + a call in `src/lib/api.ts`, and a consumer
  that renders null without data (degradation rule). `task be:verify` +
  `task typecheck` + `task build`.
- **Make a text zone live-editable:** (1) add a provenance getter to
  `src/lib/content.ts` returning an `EditRef` — it must resolve which locale's
  file actually supplied the rendered value (mirror `getUpcomingEditRef`; for
  `getSite` fields the rule is: the active locale's file iff it defines the
  key, else `en`); (2) in the component, render an `EditButton` **only when**
  `useEditMode().active`, calling `useContentEditor().openField({ title, ref,
  onSaved })` — use `onSaved` to update local state so the editor sees the
  change immediately; (3) nothing else — the popup handles fetch, YAML
  surgery, sha conflicts, and the commit. Markdown-file zones want a whole-file
  variant (not built yet — extend `openField` when the first one lands).
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
- **`/api/*` returns HTML 200 on Pages/nginx** (SPA fallback), not a 404 — so
  `api.ts` treats any non-`application/json` content-type as "backend
  unavailable". Never assume a 200 means real data.
- **`compose.dev.yaml` volumes are `external: true`** (`gaias-choice-node-modules`,
  `gaias-choice-go-cache`) — they must exist before `up`. `task dev` creates
  the Go one and `deps` guarantees the node one; a bare `docker compose up`
  needs `docker volume create` first.
- **air is pinned to `v1.61.7`** in `compose.dev.yaml` — the last release whose
  `go.mod` is `go 1.23`; newer tags require Go ≥1.24/1.25 and won't run on the
  pinned `golang:1.23-alpine`. air is run-not-imported (never in `go.mod`); bump
  it only alongside the Go image.
- **Go toolchain is containerized too** — never `go` on the host; use the
  `be:*` tasks (deps cached in the `gaias-choice-go-cache` volume). First
  `modernc.org/sqlite` compile is slow; the cache makes it a one-time cost.
- **Edit mode activates via `#edit`**, not any visible UI: open any page with
  `#edit` in the URL → token prompt (empty input signs out; the hash is
  stripped immediately). The token lives in `localStorage['gc-edit-token']`
  and is validated against `/api/content/ping` on every load — a 401 clears
  it, BE-down just leaves mode off. Nothing edit-related renders for readers.
- **Content routes answer 503 until armed:** `/api/content/*` needs BOTH
  `ADMIN_TOKEN` and `GITHUB_TOKEN` set on the BE — either missing ⇒ 503
  "editing not configured" (deliberate: a repo-write PAT behind a public
  ngrok tunnel must never be open). For local editing, pass them to the api
  service (e.g. a git-ignored `.env` + `env_file` in `compose.dev.yaml`, or
  `-e` flags on `task be:dev`'s docker run). The PAT is fine-grained,
  Contents RW, this one repo only.
- **YAML edits must go through the CST route** (`applyScalarEdit` in
  `contentEditor.tsx`): `parseDocument(...).toString()` re-folds long block
  scalars and churns ~190 lines of site.yaml — `CST.setScalarValue` on the
  source token changes exactly one line. Verified byte-for-byte; keep it
  that way.
- **Committing/shipping:** never commit automatically — ask the owner first.
  When confirmed, ship via a **background agent** (commit on `main` with a
  Conventional-Commits message, `git push origin main`, then a single
  deploy-conclusion check with a rerun on transient Pages failure) — the full
  procedure lives in SKILL.md "Committing & shipping". **The push is a
  deploy:** `deploy-pages.yml` builds and publishes to GitHub Pages on every
  push to `main`. Feature branches + PRs are the planned future flow, not yet
  active.

## The dev roadmap (in priority order — from `/roadmap`)

1. **Build-time prerendering** of every route to static HTML — the keystone:
   unlocks real SEO, Open Graph, Pinterest Rich Pins. Plan picked and waiting
   on the custom domain — see `context/seo/seo-paths.md` (per-page
   title/meta already ships client-side via `src/lib/head.tsx`; the prerender
   bakes the same values into the HTML crawlers see).
2. `sitemap.xml` generated from `content/` at build time (`public/robots.txt`
   already has a commented Sitemap line awaiting the domain).
3. Privacy-friendly cookieless analytics (update `/privacy` first).
4. `/go/<slug>` affiliate redirect service with click counting — check each
   program's cloaking policy (Amazon forbids it; raw links there).

When you complete one of these, tick it on the roadmap — both locales
(maintenance rules: `content-editing.md` "The roadmap").
