# Frontend (and eventually backend) config — options

Options doc per SKILL.md's "Big tasks" process. Question on the table: where
should visual/functional parameters live — `site.yaml`, a new config file, or
somewhere else — and does the backend need a YAML config too?

## Current state (verified in the repo)

Config is already split three ways, by **who changes the value and how
often**, not by "frontend vs backend":

1. **`content/locales/*/site.yaml`** — editorial/business data, one owner
   edit at a time, sometimes localized: nav, footer nav, mission/values,
   `epics`, `sidebar` composition, `ratingCriteria`, `support` payment
   config, social links, contact email. This is `SiteConfig` in
   [types.ts](../../src/lib/types.ts). It's already "config-as-data" — no
   code change needed to add a nav item or reorder the sidebar.
2. **`content/themes.yaml`** — color palettes only. Deliberately separate
   from `site.yaml` because it's **visitor-switchable at runtime**
   (`ThemeSwitcher` writes `localStorage['gc-theme']`) and locale-independent,
   where `site.yaml` is per-locale editorial content. [theme.ts](../../src/lib/theme.ts)
   maps each palette's 10 color keys straight onto CSS custom properties.
3. **`src/styles.css` `:root`** — structural design tokens: `--radius`
   (22px), `--radius-sm` (14px), `--shadow`, `--wrap` (1180px), `--ink`,
   `--muted`, `--white`. These are **not** in `themes.yaml` — they don't vary
   per palette, only the 10 color slots do. Breakpoints (`900px`, `720px`,
   `480px`, etc.) are inlined in ~15 `@media` rules, not variables at all —
   there's no single breakpoint token to promote.
4. **Backend `internal/config/config.go`** — env vars only, no YAML today.
   Every value is either a **secret** (GitHub PAT, SMTP/Postmark/Telegram/
   Anthropic keys, bootstrap admin password) or a **deployment topology**
   value that differs per environment (port, CORS origins, data dir, public
   site URL). `envOr()` supplies dev defaults; `task dev` / `compose.dev.yaml`
   / the VM's `deploy.env` set the rest. This is the standard 12-factor
   pattern and it's containerized the same way npm is (nothing host-side).

So the site already follows golden rule #1 ("content is data, code is
layout") for everything an owner edits regularly. The open question is really
about the two things that *aren't* config yet: static design tokens (#3) and
backend non-secret settings (#4) — because no one has needed to change either
at runtime, they were never pulled out.

## What "visual and functional parameters" could mean

Worth naming explicitly, because the right home differs per bucket:

| Bucket | Example | Changes how often | Current home |
|---|---|---|---|
| Editorial/business data | nav labels, support wallets, epic blurbs | per owner edit, occasionally | `site.yaml` ✅ |
| Visitor-switchable theme | the 10 palette colors | per visitor, never by owner | `themes.yaml` ✅ |
| Static design tokens | radius, shadow, wrap width | almost never | `styles.css` (hardcoded) |
| Feature flags | none exist today | — | n/a |
| Backend secrets | API keys, tokens | per environment | env vars ✅ |
| Backend deploy topology | port, CORS origins, data dir | per environment | env vars ✅ |
| Backend business tuning | none exist today (e.g. session TTL is a Go const) | — | Go constants |

## Candidate paths

**A — Status quo, document the split, add fields only on real need (recommended).**
Keep `site.yaml` for editorial data, `themes.yaml` for palette colors,
`styles.css` for static tokens, env vars for the backend. When a genuine new
knob shows up (an owner wants to tweak `--radius` without a code change, or
the backend needs a non-secret tunable), add it to the file that already
fits that bucket — a new top-level key in `site.yaml`, a new color in
`themes.yaml`, or a new env var. No new files.
- Cost: none now.
- Risk: none — this is where the repo already is.

**B — Pull static design tokens (radius/shadow/wrap) into `themes.yaml`.**
Extend each palette with `radius`, `shadow`, `wrap` so a palette can also
restyle shape, not just color. `theme.ts` already has the CSS-var-mapping
plumbing — extending `CSS_VARS`/`ThemeColors` is a few lines.
- Worth it only if a palette ever wants a genuinely different shape (e.g. a
  sharper-cornered "citrus" look). No such request exists today.
- Cost: small (one interface + loop extension). Skip until a palette
  actually wants non-default shape values — speculative otherwise.

**C — New `config/frontend.yaml` (or `site.yaml` `features:` block) for feature
flags.**
Only relevant once the site actually has a flag to gate (e.g. "show the
almanac panel," "enable the campfire before backend is ready"). Today there
are zero feature flags — `editing`/`backendUp` are already runtime-derived
from `/api/auth/me` and a health probe, not config. Adding a flags file now
would be a config file with nothing in it.
- Skip entirely until a concrete flag is needed. If/when one is, a
  `features:` key in `site.yaml` (same file, one more key) beats a new file —
  one less place to look.

**D — Backend YAML config file.**
Would either (a) duplicate every env var in a checked-in file — redundant
with the existing `envOr()` scheme and compose/deploy.env wiring, or (b)
hold secrets in YAML, which is strictly worse than env vars (checked-in risk,
no per-environment override without templating). Neither improves on what's
there. The only case for a *non-secret* backend YAML is business tuning
values (rate-limit thresholds, TTLs) growing past a handful of Go constants
— that hasn't happened; today session TTL, rate limits etc. are small
in-code constants, which is the right size for their volatility (never
changed without a code review anyway).
- Recommendation: don't build this. Revisit only if backend tunables
  multiply past what's comfortable as constants — cross that bridge then.

## Cross-cutting decision

The real axis isn't "frontend vs backend" or "YAML vs code" — it's **who
changes the value and how often**:
- Owner edits it through the live-edit portal or a content PR → `site.yaml`
  (localized) or a sibling non-localized block in `en/site.yaml`.
- Visitor picks it at runtime → `themes.yaml` (the one config surface that's
  visitor-facing, not owner-facing).
- Changes only with a code change anyway (shape tokens, Go constants, env
  vars) → stays in code/CSS/env, because a config file wrapping a value
  nobody edits without redeploying adds a lookup indirection for zero
  flexibility gained.

## Recommendation

**Path A.** Nothing to build right now — the split that exists already
matches the "who/how often" axis correctly. Don't create `config/frontend.yaml`
or a backend YAML file speculatively; extend `site.yaml`/`themes.yaml` with a
new key, or add one backend Go constant/env var, the day a concrete value
needs to move. If you have a specific value in mind that prompted this (e.g.
"I want to tweak `--radius` without touching CSS," or "the backend needs a
configurable rate limit"), name it and we can size Path B/C/D for that one
value instead of building general infrastructure ahead of a need.

## Resolution

Path A confirmed. One concrete knob surfaced: a **sitewide DEBUG flag** to gate
dev-only chrome (the mobile-viewport read-out, future debug overlays). It did
**not** go into `site.yaml` — a debug flag is developer tooling, not
owner-edited editorial content, and `site.yaml` ships to the visitor bundle
(setting it true and committing would deploy debug UI to real visitors). It's a
**Vite env gate** instead — `src/lib/debug.ts` exports `DEBUG`, on automatically
in `vite dev`, forceable with `VITE_DEBUG=true|false`, and OFF by default in the
prod Pages build regardless of any content. This is the "changes only with a
code change anyway → stays in code/env" bucket from the cross-cutting axis.
