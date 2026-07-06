# SEO paths — making every page indexable without giving up the SPA

Goal: SEO-friendly URLs + crawlable pages, while keeping (a) the repo simple
(content-as-data, 6 runtime deps, container-only npm), and (b) the browser
fast (instant client-side navigation after load).

## Decision (owner, 2026-07-06) — picked, deferred

- **Path A is picked**, with a twist: skip the A1/A2 staging and do **both
  locales in one effort** (the `/en/…` URL tree, hreflang pairs, and a
  URL-aware language switcher ship together with the prerender).
- **Implementation is on hold until the owner has a custom domain.** Reason:
  canonical URLs / sitemap / Search Console history accrue to the origin, and
  moving domains after indexing starts resets that equity (see "Custom
  domain" under cross-cutting decisions). The owner will have the domain when
  we resume — no work should start before it exists.

### Resume checklist (first session after the domain exists)

1. Wire the domain: Pages custom domain (CNAME) + enforce HTTPS,
   `BASE_PATH=/` in `.github/workflows/deploy-pages.yml`, update `url:` in
   `content/locales/en/site.yaml`. GitHub auto-redirects the old
   `github.io/gaias-choice/` URLs to the custom domain for the same repo.
2. Re-verify every claim in "Where we stand" below against the then-current
   code (routes in `App.tsx`, browser-API audit, deploy workflow) — this doc
   describes the repo as of the decision date and code drifts.
3. Write `action-plan.md` next to this file per SKILL.md "Big tasks"
   (numbered steps, files touched, success criterion each), covering at
   least: route manifest derived from `content/` for **both** locales;
   `src/entry-server.tsx` + `vite build --ssr`; per-route head helper
   (title/description/canonical/OG + hreflang pairs + client-side
   `document.title` hook); `scripts/prerender.mjs` writing
   `dist/<route>/index.html` and `dist/en/<route>/index.html` + `sitemap.xml`
   + `robots.txt`; `hydrateRoot` switch in `main.tsx`; locale-from-URL
   (routing prefix, switcher navigates instead of only setState, localStorage
   demoted to a preference redirect at most); almanac mounted client-side;
   `404.html` restored to a real not-found page; site-wide raster og:image;
   Taskfile + workflow build-chain updates; verification = typecheck, build,
   curl-status + grep-HTML spot checks on `dist/`.
4. Get the owner's agreement on the action plan, then execute step by step.

Everything below is the analysis that decision was based on.

## Where we stand (verified in the repo, not guessed)

1. **Every URL except `/` returns HTTP 404 today.** GitHub Pages has no
   rewrites; the deploy copies `index.html` → `404.html` so deep links *look*
   fine, but Pages serves them with a 404 status. Crawlers take the status
   literally: only the homepage is indexable at all right now. This is the
   single biggest blocker, and it's invisible in a browser.
2. **One `<head>` for the whole site.** `index.html` has one hardcoded
   title/description, `lang="ru"`; nothing (not even client-side JS) updates
   `document.title` per route. No OG/Twitter tags, no canonical, no
   sitemap.xml, no robots.txt → no social/Pinterest previews either.
3. **Locale is localStorage, not URL.** `ru` and `en` share every URL, so a
   crawler can only ever see one language per URL, and hreflang is impossible
   until locale becomes addressable.
4. **Everything else is favorable.** URLs are already clean content-derived
   slugs. All content is bundled at build time (`import.meta.glob`) — this is
   a static site that happens to render in the browser. Browser-API usage in
   `src/` sits inside event handlers/effects (or is `typeof window` guarded),
   so the component tree is near-SSR-safe already. And CI already runs plain
   `npm ci` on the runner, so a prerender step costs nothing there.
5. **The roadmap already commits to the answer's shape**: Phase 1 dev track
   lists per-page title/meta, *build-time prerendering (keystone)*,
   sitemap.xml, Search Console.

## What "SEO-friendly" must mean here

- Every real route returns **HTTP 200 with real HTML** (content in the HTML,
  not only after JS runs).
- **Per-page** title, meta description, canonical, OG/Twitter tags.
- **sitemap.xml + robots.txt** generated from `content/` at build time.
- Later: locale-addressable URLs + hreflang; structured data (JSON-LD).
- Unchanged: repo layout, content model, dep count, post-load SPA speed.

---

## Path A — Prerender the existing SPA in place (recommended)

Keep Vite + React + the exact same repo shape. Add a build step that renders
every route to a real `dist/<route>/index.html`, then let React **hydrate**
in the browser — after which it's the same SPA it is today (router takes
over, navigations are instant, no further HTML fetches).

Mechanics (all standard Vite SSG practice, **zero new dependencies** —
`react-dom/server` and `react-router-dom`'s `StaticRouter` are already in
the tree):

- `src/entry-server.tsx`: renders `<App>` for a given URL + locale via
  `StaticRouter`; built with `vite build --ssr`.
- `scripts/prerender.mjs`: derives the route list from `content/` (the same
  slugs `content.ts` derives), renders each route, injects the HTML + a
  per-route `<head>` block into the built template, writes
  `dist/reviews/<slug>/index.html` etc. Also emits `sitemap.xml` +
  `robots.txt`. One script, runs in CI and in the build container.
- `main.tsx` switches `createRoot` → `hydrateRoot` when the root has
  prerendered children.
- A tiny head helper (no react-helmet): route → `{title, description, image}`
  from frontmatter/site.yaml; the prerender script writes it into the static
  head, and a ~10-line client hook keeps `document.title` fresh on SPA
  navigation.

Why it wins:

- **Fixes the 404-status problem for free** — real files exist per route, so
  Pages serves 200s; `404.html` goes back to being a true 404 page.
- **Full HTML content** for every crawler and social preview, not just
  Google's JS renderer.
- **Faster first paint than today** (content HTML arrives before JS).
- Repo stays exactly as it is: content model untouched, no new deps, `src/`
  gains one entry file + one script.

Risks / wrinkles (all manageable, addressed in the action plan):

- **Hydration mismatches**: stored locale/theme differ from the prerendered
  default; the almanac renders "current month" (build date ≠ view date).
  Mitigations: prerender in the default locale and re-render on mismatch
  after mount; mount the almanac client-side (it's a sidebar widget, zero
  SEO value).
- One-time SSR-safety audit of components (scan shows it's already clean;
  the audit is a verification pass, not a refactor).

Staging:

- **A1 (now):** prerender every route in the default locale (`ru`); `en`
  stays the client-side switch it is today. Indexes the Russian site fully.
- **A2 (when EN search traffic matters):** emit a parallel `/en/…` tree from
  the same prerender script, add hreflang pairs, teach the language switcher
  to navigate instead of only setState. This is the "locale in URL" decision
  — deferrable, and A1 doesn't paint us into a corner.

Effort: one solid session for A1 (entry-server + prerender script + head
helper + sitemap + verify), a shorter follow-up for A2.

## Path B — Meta-shell prerender (half-step, no SSR)

Same route manifest and sitemap as A, but instead of rendering React, copy
`index.html` per route with only the `<head>` rewritten (title, description,
OG, canonical). Body stays an empty `#root` filled by JS.

- Gets: 200 statuses, per-page meta, social previews, sitemap — with a
  trivial script and zero hydration risk.
- Doesn't get: content in the HTML. Google renders JS and would cope; other
  crawlers/LLM indexers see empty pages. The roadmap's keystone item stays
  half-done.
- Verdict: only worth it as a checkpoint *inside* Path A (its route-manifest
  and head code are the first half of A anyway). Not a destination.

## Path C — Migrate to a static framework (Astro)

Astro (or similar) with islands for the interactive bits (almanac, theme and
language switchers) would give best-in-class static output and per-page JS
trimming.

- Cost: rewrite of every component/layout, a much larger dependency tree
  (violates the 6-dep rule), new build system to learn/contain, and the
  content-loading layer redone. The current SPA feel (instant client-side
  navigation everywhere) needs extra work to recreate.
- Verdict: not now. Reconsider only if the site outgrows Path A (thousands
  of pages, per-page JS budgets). Path A leaves this door open — content
  stays framework-agnostic markdown/YAML.

## Rejected outright

- **Dynamic rendering / bot-only prerendering** (prerender.io, UA-sniffing
  worker): deprecated by Google, adds infra + a cloaking smell to a site
  whose whole brand is honesty.
- **Hash routing**: worse URLs, solves nothing we need.

---

## Cross-cutting decisions (whichever path)

- **Custom domain**: today's URLs live under
  `dennislapchenko.github.io/gaias-choice/`. Search equity accrues to the
  domain — if a custom domain is ever planned, wire it (Pages CNAME +
  `BASE_PATH=/`) *before or with* the SEO launch, not after Search Console
  history starts accruing. Decision needed from the owner; everything below
  works either way.
- **og:image**: social crawlers won't rasterize SVG mandalas. Start with one
  committed site-wide raster og:image; per-page rasters can come later
  (e.g. a `task` target that rasterizes mandalas).
- **Structured data (JSON-LD `Product`/`Review`)**: NOT until placeholder
  reviews are deleted — fake ratings in structured data is exactly what
  Google's spam policies punish and exactly what the site's trust contract
  forbids. Wire the slot, ship it with real reviews.
- **`404.html`**: after prerendering, restore it to a real not-found page so
  unknown URLs are genuinely (and correctly) 404.
- **Analytics / Search Console**: separate roadmap items; prerender +
  sitemap are their prerequisites, nothing more shared.

## Recommendation

**Path A, staged (A1 now, A2 later)** — it's the only path that fixes the
404-status blocker, puts real HTML behind every URL, keeps all six runtime
deps and the whole repo shape, and *improves* browser speed rather than
trading it away. Path B exists inside it as a natural checkpoint; Path C
stays available later because content remains plain markdown/YAML.
