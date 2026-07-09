# Repo audit — surgical high-gain tweaks (findings + candidate fixes)

Produced by a full read of `frontend/src`, `backend/internal`, `deploy/`,
workflows, Taskfile, Dockerfiles, nginx template — plus one measured
production build. Per SKILL.md "Big tasks": this is the options doc; the
owner picks, then an `action-plan.md` lands next to this file before any code
moves. Nothing below has been applied.

## Verified baseline (what the "good look" found)

**The build (measured, `task build`, 2026-07-09):**

```
dist/assets/index-*.css    53.84 kB │ gzip:  10.45 kB
dist/assets/index-*.js  1,957.79 kB │ gzip: 579.04 kB   ← ONE chunk
```

Composition of that single 1.96 MB chunk (measured from disk/node_modules):

- **~1.5 MB is content** — all 119 markdown files (both locales), site.yamls,
  themes, diagram SVGs, bundled as raw strings by design (the content-in-bundle
  invariant; minification can't shrink strings, gzip handles it well).
- ~450 KB is code: `astronomy-engine` (~135 KB min — the single biggest dep),
  react-dom (~130 KB), `yaml` (inflated beyond parse-only because
  `contentEditor.tsx` imports its full CST/Composer/Parser AST tooling into the
  visitor bundle), marked, router, app code.

**Boot work every visitor pays** (`src/lib/content.ts` module evaluation,
before first paint): `marked.parse` + 3 regex passes over **all 119 markdown
bodies**, both locales — yet `entry.html` is only ever read by the four detail
pages (`EntryDetail`, `ReviewDetail`, `MarkdownPage`, `Support`), never by
listings. A visitor who bounces off the homepage parsed the entire corpus for
nothing. On top: `astronomy-engine` evaluates and (desktop: almanac panel is
`desktopOpen: true`) computes a full ephemeris month on every first load.

**What's already good (don't touch):**

- Backend is genuinely clean: argon2id + dummy-hash timing defence, sha256-
  hashed session tokens, pruned hand-rolled rate limiters, SQLite WAL +
  single-conn + embedded migrations, contract-drift gate in `be:verify`,
  ponytail ceilings documented inline. No findings worth a diff.
- Deploy stack (Caddy + compose + release.sh) minimal and correct; GHCR image
  pinned by sha; Pages workflow pinned, npm-cached, concurrency-cancelled.
- Supply chain: `.npmrc` ignore-scripts honored everywhere incl. CI (`npm ci`
  runs in `frontend/`, reads its `.npmrc`); tsconfig fully strict.
- Degrade path: backend-down costs one swallowed `/healthz` fetch. Solid.

## Findings, ranked by gain ÷ effort

### 1. Lazy-chunk the almanac — biggest code win, ~3 lines

`Sidebar.tsx:3` statically imports `AstroCalendar` → `astro.ts` →
`astronomy-engine` (~135 KB min / ~40 KB gzip) rides the critical chunk, plus
its eval + first-month ephemeris compute on the boot path.

**Fix:** `const AstroCalendar = React.lazy(() => import('./AstroCalendar'))`
+ `<Suspense fallback={null}>` in `AlmanacBody`. Vite splits astro.ts +
astroText.ts + astronomy-engine into an async chunk fetched after first paint.

**Gain:** main chunk −~150 KB min; boot CPU drops the ephemeris entirely.
**Risk:** almanac panel appears a beat later (empty fallback) — cosmetic.

### 2. Parse markdown on demand, not at boot — big TTI win, one function

`content.ts` `loadCollection` (line ~150) eagerly converts every file to HTML.

**Fix:** keep frontmatter eager (listings need it), make `html` a lazy
memoized property (`Object.defineProperty` getter that runs `marked.parse` +
`withBaseHtml` on first read, caches). Consumers keep reading `entry.html` —
zero call-site changes. The global `diagramInstance` counter stays unique
under any parse order.

**Gain:** boot main-thread work drops from "parse 1.4 MB corpus" to "parse
the one document you're looking at, when you look at it". Phones/battery
benefit most. Bundle size unchanged (strings ship either way).
**Risk:** low; first detail-page open does its own parse (~1–3 ms — invisible).

### 3. Typecheck gate in the Pages deploy — one CI line, real safety

`vite build` does not type-check (CLAUDE.md gotcha), and
`deploy-pages.yml` runs build only — a `src/` push with a type error deploys
to production silently. **Fix:** add `npm run typecheck` step before Build.
Costs ~15 s CI; content-only pushes can't fail it (they don't touch types).

### 4. Vet+test gate in the backend image CI

`build-backend.yml` pushes to GHCR (→ VM) without running `go vet`/`go test`
— the local `be:verify` gate has no CI counterpart. **Fix:** one step before
build-push (`go vet ./... && go test ./...` in the golang container or
setup-go). Broken API images stop reaching the registry.

### 5. Skip Pages rebuilds for docs-only pushes

`deploy-pages.yml` triggers on *any* push to `main` — a `context/` or
`.claude/` doc commit rebuilds and redeploys the whole site (~2 min CI, a
no-op deploy). **Fix:** `paths-ignore: ['context/**', '.claude/**',
'CLAUDE.md', 'README.md', 'deploy/**']`. Never ignore `content/**` or
`frontend/**`. (Mind: skips also skip the `deployWatch` version bump — fine,
nothing user-visible changed.)

### 6. nginx: hardening headers silently dropped on /assets/ + doubled Cache-Control

`frontend/nginx/default.conf.template`: nginx's `add_header` inheritance rule
— a location with *any* `add_header` inherits *none* from server level — means
`location /assets/` (line 12) loses `X-Content-Type-Options` etc. Also
`expires 1y` + `add_header Cache-Control` emits two Cache-Control headers.
**Fix:** drop `expires`, use one
`add_header Cache-Control "public, max-age=31536000, immutable"`, and repeat
the three hardening headers in the location (or move all four into an
include). Local-check/fallback image only — not the live Pages host — but it's
a latent footgun for the "any future container host" story.

### 7. Dead font preconnect

`frontend/index.html:12` preconnects to `fonts.googleapis.com`; the site uses
a pure system font stack (styles.css `:root`), no Google Fonts anywhere.
Delete the line — one wasted TLS handshake per cold visit, and a lie to the
next reader.

### 8. Split the editor surface out of the visitor bundle — phase 2

`contentEditor.tsx` (1200 lines) + `FrontmatterFields` + `ImagePicker` +
`ImageFrame` + `LoginDialog` + `AccountFields` — plus yaml's CST/Composer/
Parser AST machinery it imports (`contentEditor.tsx:34`) — ship to every
visitor; they serve ~2 signed-in humans. Realistic split: keep the contexts
sync-thin, `React.lazy` the heavy UI behind `me.editing` / `loginOpen`.
**Gain:** est. −80–150 KB min. **Effort:** medium (provider restructure), so
it ranks below the one-liners despite the size. Do after 1–2 prove out.

## Nits (batch into any of the above)

- `SaveContent`/`CommitContent`/`DeleteContent` (`server.go`) truncate commit
  messages with `msg[:200]` — can cut a UTF-8 rune mid-byte (Cyrillic
  messages are the norm here). One-line fix: trim to valid UTF-8.
- `frontend/package.json` description still says "RV travel" — the site was
  deliberately reframed camper/car/carry-on (CLAUDE.md "What this is").
- `context/` holds shipped plans (`auth/`, `backend/`, `editor-images/`,
  `token-budget/`) that per SKILL.md belong in `context/archive/` —
  housekeeping-skill territory.

## Deliberately NOT proposed

- **SEO prerendering** — decided and deferred by the owner until the custom
  domain exists (`context/seo/seo-paths.md`). Findings 1–2 are compatible
  with it (the resume checklist already plans a client-side almanac mount).
- **Per-locale content chunks** (a RU visitor ships all EN bodies too):
  fights the en-fallback design for ~200 KB gzip; not worth the coupling
  while finding 2 removes the parse cost anyway. Ceiling, not a task.
- **Backend refactors of any kind** — it's the cleanest corner of the repo.

## Recommended order

**1 → 2 → 3+4+5 (one CI commit) → 7 → 6**, re-measure the build after 1–2
(expect main chunk ≈ 1.8 MB with astro split out, and boot parse gone), then
decide whether 8 is still worth its diff. Success criteria per step go in the
action plan once a path is picked.
