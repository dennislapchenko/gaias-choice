# SEO action plan — Path A, executed under the temporary domain

Path A (prerender the SPA in place, both locales in one effort) was picked in
`seo-paths.md` on 2026-07-06 and held until a custom domain existed. The owner
lifted the hold on 2026-07-10: build it now under
`https://dennislapchenko.github.io/gaias-choice`. Domain-day is a config flip
(see "Domain day" below) — GitHub 301-redirects the old project-page URLs to a
later custom domain, so nothing indexed meanwhile is wasted or duplicated.

## Ground rules

- **Every absolute URL derives from `site.yaml` `url:`** (already exists, holds
  the temp origin today). Canonicals, og:url, hreflang, sitemap, robots — one
  source. Flipping the domain later regenerates them all.
- **Zero new dependencies.** `react-dom/server`, `react-router-dom`'s
  `StaticRouter`, and Vite's `--ssr` are already in the tree.
- **RU is the unprefixed default tree (`/…`), EN lives under `/en/…`.** URL
  wins over the stored preference; `localStorage['gc-lang']` demotes to a
  preference memory.
- **Pages are written as `dist/<path>.html`** (plus root `index.html`) so
  GitHub Pages serves the exact no-trailing-slash route URLs with 200 and no
  redirect hop; canonicals match the served URL exactly. The nginx template
  gains `$uri.html` in `try_files` so the container behaves the same.
- Content model, repo layout, and post-load SPA behavior stay untouched.

## Steps

Each step: files touched → success criterion.

### 1. Locale becomes the URL (`/en` prefix)

- `src/lib/i18n.tsx`: locale derived from the router location (`/en` prefix ⇒
  `en`, else `ru`); `setLocale` navigates to the sibling URL and stores the
  preference; `initI18n` keeps setting `<html lang>`.
- `src/App.tsx`: one route-table definition mounted at both `/` and `/en`
  (single source, two mounts — no duplicated table).
- One locale-aware link helper; sweep every internal `<Link>`/`href` in
  `components/` + `pages/` (`Layout`, `Sidebar`, `Home`, cards, `Upcoming`,
  `NotFound`, the language switcher) through it. Audit via grep for `to="/`
  and `href="/`.
- Root-entry redirect only: landing on exactly `/` with stored pref `en` does
  a client-side `replace` to `/en` (crawlers have no localStorage — no-op for
  them; deep links never redirect).
- **Success:** dev server — `/en/reviews` renders EN, `/reviews` RU; the
  switcher flips any page to its sibling URL; deep link `/en/compass/<slug>`
  works; typecheck green; checked at mobile width (switcher lives in the
  rail/tab-row).

### 2. SSR-safety pass + almanac goes client-mounted

- `src/components/AstroCalendar.tsx`: render only after mount (its "current
  month" is date-dependent — build date ≠ view date — and it has zero SEO
  value). Placeholder keeps the panel's height stable.
- Audit: no module-scope `window`/`document`/`localStorage` anywhere the
  server entry imports (2026-07-10 spot check: all usage sits in
  functions/effects; the step-3 bundle import is the proof).
- **Success:** the step-3 SSR bundle imports under plain `node` with no
  `ReferenceError`; almanac absent from prerendered HTML, appears after
  hydration.

### 3. Server entry + per-route head resolver

- `src/entry-server.tsx` (new): exports `routes(locale)` — the manifest
  derived from the same content getters the site uses (all active + upcoming
  detail slugs, static pages, listings; utility shells `/magic` + `/account`
  flagged noindex; epics absent from a locale's `site.yaml` are absent from
  that locale's manifest — `inside-websites` stays EN-only) — and
  `render(path, locale) → { html, head, lang }` via `StaticRouter` +
  `I18nProvider` with a forced initial locale.
- Head resolver (in `entry-server.tsx` or `src/lib/pageMeta.ts`): per route —
  title (same composition rule `head.tsx` uses), meta description (excerpt ‖
  site description), canonical, `og:title/description/url/type/site_name/locale`
  + `og:image` (site-wide raster) + `twitter:card`, hreflang pair + `x-default`
  → ru (emitted only when the sibling exists), `robots: noindex` for
  `state: upcoming` posts and the utility shells. `head.tsx` stays as-is for
  client-side SPA-navigation updates.
- `package.json`: `build` becomes client build + `vite build --ssr` + prerender.
- **Success:** `node -e` renders `/` (ru) and `/en/compass/<real slug>` to
  strings containing real body text and the full head block.

### 4. `scripts/prerender.mjs` — pages, 404, sitemap, robots

- New script: for every manifest route × locale, render and write
  `dist/<path>.html` (root `/` → `index.html`), injecting body HTML + head
  block + `lang` into the built client template.
- `dist/404.html` = prerendered `NotFound` (returns a real 404 page that still
  hydrates into the full SPA). Replaces the workflow's `cp index.html
  404.html` hack.
- `dist/sitemap.xml`: indexable URLs only (active posts + listings + pages,
  both locales, `lastmod` from frontmatter `date`). `dist/robots.txt` with the
  absolute `Sitemap:` line — script-owned now; **delete `public/robots.txt`**
  (one home).
- Self-check inside the script: every sitemap URL has a written file; page
  count printed and non-zero.
- **Success:** script exits 0; greps pass — canonical + hreflang in a review
  page, `noindex` in `dist/magic.html` and an upcoming slug, not-found copy in
  `dist/404.html`; sitemap count equals manifest count.

### 5. Hydration

- `src/main.tsx`: `hydrateRoot` when `#root` has children, `createRoot`
  otherwise (dev server unchanged).
- **Success:** serve `dist/`; browser console free of hydration warnings on
  `/`, `/en/reviews`, one detail page; theme switcher, language switcher,
  almanac all interactive.

### 6. og:image raster

- `frontend/public/og-default.jpg` (new): one site-wide 1200×630 JPEG,
  ImageMagick in a container (same pattern as `task images`), from an
  owner-picked real photo — default candidate `public/images/about.webp`.
  Social crawlers won't rasterize the SVG mandalas.
- **Success:** file exists, ≲300 KB, referenced by every prerendered head.

### 7. Build chain

- `Taskfile.yml` `build` (verify it just runs `npm run build` — then it's
  already the full chain), `.github/workflows/deploy-pages.yml` (drop the
  SPA-fallback copy step), `frontend/Dockerfile` (build already runs the npm
  script → prerender comes free), `frontend/nginx/default.conf.template`
  (`try_files $uri $uri.html` + `error_page 404 /404.html` replacing the
  blanket SPA fallback).
- **Success:** `task build` in the container emits a prerendered `dist/`;
  `task run` serves a deep link with 200 and an unknown path with 404.

### 8. End-to-end verify, docs, roadmap, ship

- Verify: `task typecheck && task build`; serve `dist/`, browser pass desktop
  + mobile; grep spot checks from step 4.
- Docs (same session, per SKILL.md): `CLAUDE.md` ("client-rendered SPA" →
  prerendered-then-hydrated; locale-in-URL; head.tsx sentence),
  `references/development.md` (Where-things-live rows: entry-server,
  prerender script, locale-URL mechanics, nginx line, build chain; "add a
  locale" task), `content/locales/README.md` (URLs carry the locale),
  `head.tsx` comment (no longer interim), roadmap **both locales** (tick
  prerender + sitemap items, replace the "waiting on our own domain" note
  with the domain-day flip note, refresh footers).
- Ship per `behavior.yaml`; post-deploy: `curl -I` a deep link in each tree
  (200), an unknown path (404), `/sitemap.xml` (200).
- Move `context/seo/` → `context/archive/` once done.
- **Success:** deploy green, curl checks pass, docs current.

## Domain day (later, when the real domain exists)

| What | Change |
| --- | --- |
| `content/locales/en/site.yaml` `url:` | temp origin → `https://<domain>` |
| `.github/workflows/deploy-pages.yml` | `BASE_PATH: /gaias-choice/` → `/` |
| Pages settings | custom domain (CNAME) + enforce HTTPS |
| GitHub side | auto-301s `github.io/gaias-choice/*` → the domain — indexing transfers, no duplicate content window |
| Search Console | add the new property, resubmit sitemap (+ change-of-address) |

## Risks → mitigations

| Risk | Mitigation |
| --- | --- |
| Hydration mismatch | Locale comes from the URL (the biggest source, gone); theme is pre-React CSS vars, not React state; almanac client-mounted; session/editor UI is effect-gated. Proof = clean console in step 5. |
| A hardcoded link misses the `/en` prefix | Single link helper + `to="/`//`href="/` grep audit in step 1. |
| Pages `.html`/trailing-slash quirks | Canonical = exact served URL; post-deploy curl on both trees. |
| Route table vs. manifest drift | Both derive from content getters; the static-page list lives once in `entry-server.tsx` next to a comment pointing at `App.tsx`. |
| `BASE_PATH` subpath bugs | Absolute URLs come from `site.url` (already includes the subpath); assets keep going through `asset.ts`; CI deploy + post-deploy curls are the subpath test (as today). |
| Lazy `/account` under `renderToString` | It's a noindex shell — the Suspense `fallback={null}` output is fine. |

## Out of scope (deliberate)

- **JSON-LD `Product`/`Review`** — blocked until placeholder reviews are
  deleted (fake ratings in structured data = spam-policy territory). The head
  resolver is the slot; trivial to add then.
- Per-entry raster og:images (future `task` target).
- Search Console verification/submission — owner handoff (works fine on the
  github.io property).

Effort: steps 1–5 are the solid session; 6–8 the short tail.
