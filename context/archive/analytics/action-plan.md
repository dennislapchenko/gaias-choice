# First-party analytics — action plan (Path A: SQLite day-buckets)

Owner picked Path A (see `analytics-paths.md` — current state, rejected
alternatives, cross-cutting decisions live there; this file is the build
order). Execute top to bottom; update this file if reality diverges.

## Design constants

- Table: `traffic(day TEXT, kind TEXT, path TEXT, hits INTEGER, PRIMARY KEY(day,kind,path))`;
  `kind` ∈ `page` | `api`; `day` = UTC `YYYY-MM-DD`.
- Ranges: `today` = UTC today; `7d` / `30d` = last N UTC days incl. today.
- FE beacon skips signed-in sessions (`gc-session` token present) **unless**
  `site.yaml` `analytics: { trackSignedIn: true }` (owner decision: configurable,
  off by default; en-only inherited field, documented in
  `content/locales/README.md`).
- API counting keys on gin's `c.FullPath()`; unmatched (404 noise) skipped.
- `/track` path normalization (server-side): must start `/`, ≤128 chars,
  `[A-Za-z0-9/_.-]` only, trailing slash stripped; must be `/` or start with a
  known route prefix (`/reviews`, `/journal`, `/compass`, `/about`, `/contact`,
  `/roadmap`, `/disclosure`, `/privacy`, `/support`, `/account`); anything else
  → `(other)`. Per-IP rate limit via the existing `rateLimiter` (60/min).

## Steps

1. **Contract** — `backend/openapi.yaml`: add `POST /track`
   (public; body `{path: string}`; 204; described as the cookieless pageview
   counter) and `GET /stats` (query `range` enum `today|7d|30d`, default `7d`;
   `security: session: [admin]`; 200 `{range, pages: [{path,hits}], api: [{path,hits}]}`).
   Run `task be:gen`.
   ✓ `gen.go` regenerates clean; `git diff` shows only the two new operations.

2. **Storage** — new `backend/internal/store/migrations/007_traffic.sql`
   (table above); `store.go` methods `CountHit(kind, path string) error`
   (upsert `hits+1` for today-UTC) and
   `Traffic(kind, sinceDay string) ([]PathHits, error)`
   (`SELECT path, SUM(hits) … GROUP BY path ORDER BY 2 DESC`).
   Small `store` test: two `CountHit` same day+path ⇒ one row, hits=2;
   window sum excludes rows older than `sinceDay`.
   ✓ `task be:test` green.

3. **Backend wiring** — `internal/httpapi`:
   - counting middleware in `server.go`: after `c.Next()`, if
     `c.FullPath() != ""` ⇒ `store.CountHit("api", c.FullPath())`
     (`// ponytail: one DB write per request — batch in memory if traffic ever makes SQLite blink`);
   - `PostTrack` handler: rate-limit by client IP, normalize per the rule
     above, `CountHit("page", path)`, 204;
   - `GetStats` handler: range → sinceDay, two `Traffic()` calls.
   ✓ `task be:verify` green (spec drift + vet + test + image).
   ✓ Manual: `curl -XPOST :8787/api/track -d '{"path":"/reviews/x"}'` twice +
   `GET /api/stats?range=today` with an admin token shows `hits: 2`.

4. **FE contract + beacon** — `src/lib/api.ts`: `PathHits`, `StatsResponse`,
   `trackPageview(path)` (`apiPost('/track', …)`); new hook in
   `components/Layout.tsx` (has Router + Session context): `useLocation`
   effect on `pathname` — return early when a session token exists, else
   `trackPageview(pathname).catch(() => {})`. StrictMode double-fire is
   dev-only — accepted.
   ✓ `task typecheck` green; dev stack: signed-out nav increments, signed-in
   nav doesn't.

5. **Campfire UI** — `pages/Account.tsx` + new `components/AccountStats.tsx`:
   - registry `BUSINESS_TOGGLES: {id, adminOnly, icon, title}[]` (v1: one
     entry — `stats`, `adminOnly: true`, chart glyph), filtered by `me.role`;
     rendered as a `.biz-toggles` labeled row («Твои дела» / "Your business")
     at the top of the right rail column, above `AccountFields`;
   - `view` state `'campfire' | 'stats'`; stats: `h1` + `usePageHead` →
     «Статистика» / "Statistics"; the same `<Campfire/>` renders small,
     top-center, inside a back-to-campfire button (no FLIP move animation —
     it re-renders in place, subtle CSS scale-in);
   - `AccountStats`: range pills (today/7d/30d — reuse the Reviews chip
     pattern), `GET /stats`, two `<details open>` sections (FRONTEND / API),
     rows Path | Hits (hits right-aligned, sorted desc), muted empty/error
     line ("Пока тихо…" / backend-unavailable).
   - `styles.css`: `.biz-toggles` (rounded-square buttons, active = sage,
     house `--radius`), `.stats-*` (sections, table grid, small fire), and the
     ≤900px story: toggles row stays visible above the scene (not trapped in
     the hidden rail).
   - `src/locales/{en,ru}.ts`: ~9 strings (label, title, sections, Path
     — ru «Адрес», not «Путь» (Compass nav collision) — Hits «Очки», ranges,
     back-aria, empty).
   ✓ `task typecheck && task build` green.
   ✓ Dev-stack browser check, desktop + `preview_resize` mobile: admin sees
   toggle → stats table live counts → range pills refetch → fire returns to
   campfire; viewer/signed-out sees no toggle; direct `GET /api/stats` sans
   admin ⇒ 401/403.

6. **Policy pages** — `content/locales/{en,ru}/pages/privacy.md`:
   - move the analytics bullet from "What will change" into "What this site
     does": what's counted (page path + UTC day + total), what's never stored
     (cookies, IP, UA, profiles), signed-in visits not counted;
   - fix the stale "no accounts / no login" bullet: optional sign-in exists
     (Telegram / email magic link); an account stores display name, optional
     email, avatar, role; localStorage keys now `gc-theme`, `gc-lang`, and
     `gc-session` when signed in;
   - "Last updated" stays July 2026.
   `content/locales/{en,ru}/pages/roadmap.md`: tick the analytics item, both
   footers refreshed. Disclosure untouched.
   ✓ Both locales read naturally; `task build` green (frontmatter untouched).

7. **Docs** — `references/backend.md` (endpoints list + traffic table in
   Storage + account-page paragraph: business toggles + stats view);
   `references/development.md` "Where things live" (`AccountStats.tsx`,
   `.biz-toggles`) + a "Common dev tasks" line ("add a business toggle =
   registry entry + view component"). `CLAUDE.md`/`README.md`: no change
   (backend detail lives in backend.md).
   ✓ Docs describe the new current state, nothing stale left.

8. **Ship** — per `.claude/behavior.yaml` gate. Commit series:
   `feat: count page + api traffic in day buckets` (backend),
   `feat: business toggles + statistics view on the campfire` (FE),
   `content: privacy page — analytics live + accounts bullet fixed, roadmap tick`,
   `docs: record analytics architecture`.
   Backend changed ⇒ after push, wait for the image build, then `task
   be:deploy` (background agent per SKILL.md). Pages deploy carries the
   privacy page with/before the FE tracker; `/track` starts answering only
   after `be:deploy` — page live first, satisfying its promise.
   ✓ Live site: signed-out nav on the Pages site lands rows in the VM DB;
   admin sees them at `/account` → Статистика.

## Risks

- **Public `/track` abuse** → rate limit + allowlist normalization: junk
  collapses to `(other)`, row growth stays bounded by real paths × days.
- **Write-per-request on SQLite** → WAL + single conn serializes; traffic is
  tiny; ponytail comment marks the batch-buffer upgrade path.
- **Deploy ordering** → tracker 404s quietly (apiPost quiet-fail) until
  `be:deploy` lands; no user-visible failure mode.
- **Mobile regression** → step 5's mandatory mobile check (house rule).
