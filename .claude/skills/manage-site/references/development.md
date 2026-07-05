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
| **Language switcher** | `src/components/LanguageSwitcher.tsx` + `.lang-*` in `styles.css` | Flag-emoji button that cycles locale on click (no menu). Flags in `LOCALE_FLAGS` (`lib/i18n.tsx`). `.lang-hint` flashes the next flag on hover and for 0.5s after a click; a click sets a `dismissed` state (cleared on `mouseleave`) so the hover preview doesn't linger under a stationary cursor — CSS gate is `.lang-switcher:not(.dismissed):hover`. |
| **Theme/palette switcher** | `src/components/ThemeSwitcher.tsx` + `.theme-*` | Dropdown; palettes are data in `content/themes.yaml` (`lib/theme.ts` applies them). Each option shows swatches + the **label only** (not the `tag` id / "· default"). |
| **Sidebar** (mission, values, almanac) | `src/components/Sidebar.tsx` `WIDGETS` registry + `.side-*`/`.value-badge*` | Composition/order is data: `site.yaml` `sidebar:` list. Value icons: `VALUE_ICONS` map + `icon:` on each value. |
| Almanac calendar / astrology | `src/components/AstroCalendar.tsx` + `src/lib/astro.ts` | Real ephemeris — extend generators, never a horoscope API. |
| Reviews / guides / pages content | `content/locales/<lng>/…` | Markdown+YAML; see `content-editing.md`. |
| Site name, tagline, mission, values, nav, social | `content/locales/<lng>/site.yaml` | Per locale; shape in `SiteConfig` (`lib/types.ts`). |
| UI chrome strings (labels, aria) | `src/locales/en.ts` + `ru.ts` | Flat `t()` dictionary; keep both in sync. |
| Colors, radii, layout, breakpoints | `src/styles.css` | One stylesheet; CSS vars in `:root`. Breakpoints: 900 (sidebar stacks), 820 (nav→hamburger), 720/560/480. |
| Cards (product/guide) | `src/components/ProductCard.tsx` / `GuideCard.tsx` + `.card`/`.card-link`/`a.tag` in `styles.css` | **Whole card is clickable** via a stretched-link overlay: the title `<Link className="card-link">` paints a full-card `::after` (needs `.card { position: relative }`). Genuinely interactive children are raised above it (`.card-body a.tag { z-index: 2 }`). Media is a plain `<div>` now (not a second link). Grids collapse to 1 col on mobile. |
| Review category tag → filtered list | `ProductCard.tsx` tag `<Link>` → `Reviews.tsx` `useSearchParams` | The category chip links to `/reviews?category=<cat>`; `Reviews.tsx` reads the `category` param (validated against known categories, else `All`) so the tag filters from any page, incl. Home. Guide cards use a plain `<span>` tag (no guide taxonomy) so their whole card just navigates. |
| Routes | `src/App.tsx` | Standalone pages need a route here. |

## Commands (always via Taskfile — never host npm)

| Command | What |
| --- | --- |
| `task typecheck` | strict `tsc --noEmit` — **`task build` does NOT type-check** |
| `task build` | build SPA to `dist/` |
| `task dev` | Vite dev server :5173 — **needs a TTY** (docker `-it`); fails under preview harnesses/CI |
| `task images` | optimize `public/images` → WebP |
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
- **Sidebar composition is content-driven:** the left-rail widgets + their
  order come from `site.yaml`'s `sidebar:` list (per locale), each entry a
  `type` mapped to a component in `src/components/Sidebar.tsx`'s `WIDGETS`
  registry (`mission`, `values`, `almanac`). Reorder/drop/repeat = edit
  `site.yaml` only. **New widget type:** add a component + register it in
  `WIDGETS`, then reference its `type` from `site.yaml` (add to both `en` and
  `ru`). Unknown types are skipped; no `sidebar:` list falls back to
  `DEFAULT_SIDEBAR`. The almanac (`AstroCalendar` + `lib/astro.ts`) is real
  ephemeris math — extend its event generators, never swap in a horoscope API.
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
