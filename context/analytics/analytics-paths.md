# First-party analytics — options

Owner ask (2026-07-09): site-wide traffic counting, no third-party analytics.
Frontend pageview "clicks" sent to our API; the API also counts its own
endpoint calls. Windows: **today / last 7 days / last 30 days**. Admin-facing
dashboard lives on `/account` behind a new **"business toggles"** row
(«Твои дела» / "Your business"), per-toggle `adminOnly` visibility. Open
questions the owner posed: SQLite vs time-series DB; what our paths are; what
the policy/disclosure pages must say.

## Current state (verified in repo)

- **Page traffic is invisible today.** The site is a static SPA on GitHub
  Pages — Pages exposes **no access logs**, so page analytics *must* come from
  a frontend beacon. Only the Go API (Hetzner VM, Caddy → gin :8787) sees its
  own requests.
- **Backend storage:** SQLite WAL via `modernc.org/sqlite`
  (`SetMaxOpenConns(1)`), hand-rolled embedded migrations `001`–`006`, all SQL
  confined to `internal/store`. A demo `hits` table + `Bump()` (`GET
  /api/hello`) already proves the write path.
- **Contract-first:** every endpoint is born in `backend/openapi.yaml` →
  `task be:gen`; auth enforcement is spec-driven scopes (`session`, `editor`,
  `admin`) in `sessionAuth`. A hand-rolled per-IP fixed-window `rateLimiter`
  exists (login paths). The request logger already keys on `c.FullPath()`
  (route template, not raw URL).
- **FE seam:** `src/lib/api.ts` (quiet-fail `apiGet`/`apiPost`/`useApi`; Pages
  build points at the VM via `VITE_API_URL`); `session.tsx` owns
  `localStorage['gc-session']`; `pages/Account.tsx` is the campfire.
  `React.StrictMode` is on — double effects in dev only (prod builds
  single-fire).
- **FE routes** (`App.tsx`): `/`, `/reviews`, `/reviews/:slug`, `/journal`,
  `/journal/:slug`, `/compass`, `/compass/:slug`, `/about`, `/contact`,
  `/roadmap`, `/disclosure`, `/privacy`, `/support`, `/account`, `*` (404).
- **API routes** (`openapi.yaml`): `/healthz`, `/hello`, `/auth/login`,
  `/auth/register`, `/auth/magic`, `/auth/magic/verify`, `/auth/telegram`,
  `/auth/telegram/poll`, `/auth/logout`, `/auth/me`, `/users`, `/users/me`,
  `/users/{id}`, `/content/file` (GET+DELETE), `/content/save`,
  `/content/commit`, `/content/image`, `/content/template`,
  `/content/translate`.
- **The privacy page already promises exactly this feature** (en+ru, "What
  will change" section): *"Privacy-friendly analytics — a cookieless counter
  (aggregate page views, no personal profiles, no cross-site tracking)"* and
  commits to updating the page **before** launch. The roadmap carries the
  matching item (en:102 / ru:105: "update /privacy first, it promises exactly
  that"). RU roadmap:141 also notes a future `/go/<slug>` affiliate
  click-counter — a sibling consumer of the same data model.
- **Privacy page staleness found:** its first bullet still claims "No
  accounts… there is no login" — written before Telegram/magic-link login and
  the campfire shipped. Must be fixed in the same pass.
- **Mobile constraint:** `/account`'s right rail is CSS-toggled below 900px
  (`.rail-toggle`); any new rail element needs an explicit ≤900px story.

## Fixed by the owner's mock (not option-picked)

- `/account` rail gets a labeled row of square toggle buttons above «ТВОИ
  ДАННЫЕ» — label «Твои дела» / "Your business". Registry-driven; each entry
  configures `adminOnly` visibility. First toggle: **Statistics** (admin-only,
  chart-glyph thumbnail).
- Activating it swaps the **main column**: page title → «Статистика» /
  "Statistics"; the animated campfire shrinks and moves top-center, keeps
  burning, and becomes the button back to the campfire view; below it a
  two-section table — **FRONTEND** (Path | Hits) and **API** (Path | Hits),
  sections expandable; the **today / 7d / 30d** segmented control sits inside
  this stats layout.

## Path A — day-bucketed aggregate counts in our SQLite (recommended)

One migration, one middleware, two endpoints, one FE effect.

```sql
-- 007_traffic.sql
CREATE TABLE traffic (
  day  TEXT    NOT NULL,             -- '2026-07-09' (UTC)
  kind TEXT    NOT NULL,             -- 'page' | 'api'
  path TEXT    NOT NULL,             -- '/reviews/wool-blanket' | '/api/users'
  hits INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, kind, path)
);
```

- Write = `INSERT … ON CONFLICT(day,kind,path) DO UPDATE SET hits = hits + 1`.
- **API side:** a gin middleware counts every matched request by
  `c.FullPath()` route template (`/api/users/:id` — bounded cardinality;
  unmatched 404 scanner noise skipped).
- **Page side:** `POST /api/track {path}` — public, per-IP rate-limited
  (existing `rateLimiter`), path normalized server-side against the known
  route-prefix allowlist + charset/length caps, anything else bucketed
  `(other)`. FE fires it from a `useLocation` effect, fire-and-forget.
- **Read:** `GET /api/stats?range=today|7d|30d` — spec scope
  `session: [admin]` — returns `{pages:[{path,hits}…], api:[…]}` summed over
  the window, sorted desc.

**Pros:** zero new deps/services/backup surface; the published privacy wording
becomes literally true by construction (nothing identifying is ever written);
dashboard integrates into the campfire exactly as mocked; the future
`/go/<slug>` click counter reuses the same table (`kind='go'`).
**Cons / ceilings:** hit counts only — no uniques, referrers, countries, or
per-visitor anything (each is an additive migration or the cue to adopt
GoatCounter later); "today" means the UTC calendar day.
**Volume sanity:** ~50 live paths × 2 kinds × 365 days ≈ 36k tiny rows/year —
SQLite yawns.

## Path B — derive from server access logs

GitHub Pages exposes no logs, so page traffic is unreachable — the core ask
dies immediately. Caddy logs would cover only the API, and log retention/IP
handling drags PII in, contradicting the published promise. **Rejected.**

## Path C — self-hosted analytics product (GoatCounter / Umami / Plausible CE)

Real product features (uniques, referrers, countries, UTM). Costs: a new
service on the VM (Plausible CE = ClickHouse + Postgres; Umami = Postgres;
GoatCounter = one Go binary), a new supply-chain + auth + backup surface, a
dashboard living outside the campfire (or iframed), and a third-party tracker
script in the page. Overkill for "simple clicks"; **GoatCounter is the
named fallback** if uniques/referrers ever become a real need we don't want to
hand-build.

## Path D — a time-series database (Prometheus / VictoriaMetrics / Influx)

Built for high-cardinality machine metrics: scrapers/pushers, retention
configs, PromQL/Flux, Grafana to look at anything. Our need is three fixed
windows over a few KB/day. **Rejected** — the day-bucketed SQL table *is* the
time series, at the resolution we actually query.

## Cross-cutting decisions (Path A)

1. **UTC day buckets.** `today` = current UTC day (partial); `7d`/`30d` = last
   N days incl. today. No pruning — rows are tiny; revisit if the DB ever
   notices.
2. **No PII, ever.** No IP, no UA, no user id, no referrer, no timestamps
   finer than a day. Rate-limit IP keys live in memory only. Hence: no
   cookies, no consent banner, and the privacy page's promised wording ships
   unchanged in meaning.
3. **Signed-in sessions are not tracked** (v1): the FE beacon no-ops when a
   `gc-session` token exists — the owners/editors *are* most bootstrap-phase
   traffic and would drown the signal. Revisit when the community grows
   (e.g. track viewers, skip admin/editor).
4. **Count all matched API endpoints** incl. `/healthz` and `/track` — honest,
   bounded, zero exclusion config. (Login polling inflates
   `/auth/telegram/poll` a little; visible and harmless.)
5. **StrictMode dev double-count accepted** — dev DB only; prod single-fires.
6. **Toggle registry lives in code** (like Sidebar's `PANELS`):
   `{id, icon, adminOnly, view}` in `Account.tsx`. `site.yaml` stays
   content-only; a new toggle = one registry entry + its view component.
7. **Ship order:** the privacy-page update lands in the same push as the
   feature (Pages deploys them atomically; the BE deploy that activates
   `/track` follows the Pages deploy, so the page is live first — satisfying
   its "updated before it goes live" promise).

## Policy / disclosure impact

- **`privacy.md` en+ru:** move the analytics bullet from "What will change"
  into "What this site does" with the exact live wording — per-page view
  counters; stored data is *day + path + count*, nothing else; no cookies, no
  IP retention, no profiles; signed-in members aren't counted. **Also fix the
  stale "no accounts / no login" bullet** — accounts exist now (Telegram /
  email sign-in; what an account stores: display name, optional email,
  avatar, role). Refresh "Last updated".
- **`disclosure.md`:** untouched — nothing affiliate here.
- **Roadmap en+ru:** tick the analytics item + refresh footers when shipped.
- **No consent banner needed:** no cookies/local identifiers, no personal
  data processing — the counter stays outside GDPR-consent territory, which is
  exactly the promise already published.

## Recommendation

**Path A.** It is the smallest thing that answers "how does traffic go",
keeps every promise the site has already published, adds zero infrastructure,
and feeds the mocked campfire dashboard from one admin GET.

Next per house process: owner picks/alters a path → `action-plan.md` here with
numbered steps + verification criteria → execute.
