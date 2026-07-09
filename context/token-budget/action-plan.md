# Token-budget pass 2 — action plan

Goal: cut the fresh-session context load (~50k tokens observed) toward 20–30k.
Method: agent-efficiency-housekeeping audit, 2026-07-09 measurements.

**Status: phases 1–2 executed.** Actuals: CLAUDE.md 36,259 → 21,369 B
(−41%, ≈ −3.9k tokens/session — the 16–17 KB estimate below proved optimistic
once every invariant was kept; the remainder is load-bearing); the five skill
descriptions 3.6 KB → 2.3 KB. Repo total ≈ −4.2k tokens/session. Phase 3
resolved: **computer-use disconnected** for this project; **ponytail kept on**
(owner's call — the plugin stays active here). Phase 4 untouched.

## Where the 50k actually goes (measured/estimated)

Estimates: bytes ÷ ~3.8 for prose, lower for path-dense text; JSON tool
schemas tokenize worse, so real numbers skew a bit above these.

| Block | Owner | Est. tokens | Can this plan touch it? |
| --- | --- | --- | --- |
| Claude Code system prompt + core tool schemas | harness | ~13–15k | No |
| Desktop-app MCP schemas loaded eagerly (Claude_Preview ×13, visualize, ccd_session) | app | ~4–5k | App UI only |
| MCP instructions + deferred tool-name list (claude-in-chrome, computer-use, …) | app | ~2.5k | App UI (disconnect per project) |
| Built-in skill descriptions (dataviz, claude-api, verify, code-review, xlsx/pptx/docx/pdf, …) | app | ~5–6k | No |
| Agents list, env, gitStatus, misc | harness | ~1.5k | No |
| **CLAUDE.md (36,259 B)** | **repo** | **~9.5k** | **Yes — the big repo lever** |
| **5 repo skill descriptions (~3.6 KB)** | **repo** | **~0.9k** | **Yes** |
| Ponytail plugin: SessionStart hook manifesto + 6 skill descriptions | user | ~2k | Yes, per-repo toggle |
| Personal skills (doco-cd, gitlab-force-merge) + MEMORY.md index | user | ~0.5k | Marginal |

**Honest math.** The repo owns ~10.5k of the ~50k. Repo work alone lands
~44k. Repo + user toggles (ponytail off here, chrome/computer-use
disconnected for this project) lands ~high-30s **in the desktop app** — its
built-in MCP schemas + built-in skills (~10k) are the floor. The 20–30k
target is reachable only in **plain CLI sessions** (no app MCP layer):
trimmed repo + CLI ≈ ~28–31k. Set expectations accordingly.

## Phase 1 — CLAUDE.md: 36 KB → ~16–17 KB (saves ~5k tokens/session)

Principle (already CLAUDE.md's own rule): CLAUDE.md holds *architecture and
invariants*; mechanics live in `references/development.md` /
`content-editing.md`, which load only on demand. Verified: nearly every fat
section is already duplicated in development.md's change-X table — so most
cuts are **delete + pointer**, not moves. Exceptions marked **MOVE** were
verified absent from the references and must land there in the same commit.

| Section | Now ≈ | Action | Target ≈ |
| --- | --- | --- | --- |
| Top rules + doc-layout map | 1.7 KB | Keep; add the anti-bloat guard line (below) | 1.5 KB |
| What this is / Golden rules | 2.6 KB | Keep, light tighten | 2.4 KB |
| Directory map | 5.6 KB | Keep skeleton; prune comment fat: site.yaml field list (owned by `content/locales/README.md`), the components name-dump (Glob answers it), template/draft mechanics (content-editing.md owns) | 3.2 KB |
| How content loading works | 2.6 KB | Keep invariants (build-time glob, filename=slug, yaml-not-gray-matter reason, trusted HTML, date sort). Cut headingIdRenderer + renderDiagram paragraphs → dev.md rows 28/37 own them | 1.0 KB |
| The content sections | 6.6 KB | Biggest cut. Reviews: keep frontmatter contract + template fact; **delete the `.review-layout`/`.review-panel` CSS paragraph** (dev.md row 29 owns it). Gaia Score: keep 3-line invariant (criteria in site.yaml, scores by index, one-line relabel). Post states: keep 4-line invariant (dev.md row 31 owns the flow). Compass: keep first-tag=epic, 5-or-11 rule, epic status one-liners, provenance; cut EntryDetail/TOC/diagram mechanics. Journal/Pages: halve | 2.6 KB |
| Images | 1.9 KB | Keep 4 lines (webp under public/images, `task images` removes originals, mandala script exists, real photos replace review mandalas); mechanics → content-editing.md "Images" + dev.md row 38 | 0.7 KB |
| Styling & color | 1.3 KB | Keep var-slot summary; cut nth-child/px detail | 0.8 KB |
| Theming / palette switcher | 3.0 KB | Keep: palettes are data, add=append, exactly one `default`+`defaultDark`, current defaults, `:root` fallback sync rule. **MOVE** to dev.md row 20: dark-slot mechanics (`ink`/`muted`/`white`, SLOT_DEFAULTS), panel-tint/surface-muted explanation, per-palette WCAG notes | 1.0 KB |
| i18n | 3.7 KB | Keep: content-vs-chrome split, locales + `ru` default, en-fallback + shallow-merge invariant, do-not-calque pointer. Cut switcher behavior (dev.md row 19). **MOVE** to dev.md Common dev tasks: the adding-a-locale checklist + astroText Vocab requirement | 1.3 KB |
| Sidebar & almanac + ephemeris | 3.4 KB | Keep 2-line shell + the astro invariant block (real astrology, astronomy-engine in-browser, never a horoscope API, tz-aware-not-location-aware). Widget/event mechanics → dev.md rows 21/23 | 1.1 KB |
| Commands / Backend / Status & shipping | 2.7 KB | Already pointerized — keep | 2.4 KB |
| Container & deploy | 1.6 KB | Keep multi-stage + Pages deploy + SPA-fallback caveat; **MOVE** envsubst + strict-404 note → dev.md gotchas | 0.9 KB |
| Supply chain | 1.8 KB | Keep (it justifies golden rule 2); tighten | 1.5 KB |
| Dev gotchas | 1.7 KB | Keep typecheck-separate + DEBUG gate (2 lines each); **MOVE** ngrok allowedHosts note → dev.md gotchas; rest already pointers | 0.7 KB |
| Current content state | 2.0 KB | Keep (phase truth, required "current and short"); tighten | 1.4 KB |

**Anti-bloat guard (root cause).** The last five `feat:` commits each grew
CLAUDE.md with layout/CSS prose (review rail, panel cards, boughtAt split) —
the "update the docs" house rule is routing mechanics into the always-loaded
file. Add one sentence to CLAUDE.md's doc-layout paragraph: *"Component/CSS/
flow mechanics go into a development.md row; CLAUDE.md gets at most one
sentence + pointer."* And flip dev.md cross-refs that currently say "see
CLAUDE.md …" (e.g. row 29 → Gaia Score) so the reference is the owner.

## Phase 2 — repo skill descriptions: ~3.6 KB → ~2.2 KB (~350 tokens)

All five load every session. Keep trigger phrases + example anchors; cut the
justification prose (why the skill matters — that's body material):

- `manage-site` (950 B → ~550): keep "Always invoke first for any site
  change" + the trigger examples + the skip rule; cut the house-rules
  recital (the body enforces them anyway).
- `gaia-mentor` (650 B → ~350): the topic list has near-duplicates
  (mission/vision/positioning/philosophy…) — halve the list, drop the
  closing mission-drift sentence.
- `write-epic-course` (700 B → ~450): keep triggers + "even a single
  chapter" + the not-for-prose-edits line; cut the mechanism summary.
- `deep-questions` (500 B → ~350), `agent-efficiency-housekeeping`
  (600 B → ~400): drop rationale clauses, keep triggers.

## Phase 3 — user-level toggles (owner's call, ~4–5k tokens)

1. **Ponytail in this repo (~2k/session).** CLAUDE.md rules 1–4 + manage-site
   "Coding principles" already encode the same minimalism — in this repo the
   plugin is largely redundant. Option: repo `.claude/settings.json` →
   `"enabledPlugins": {"ponytail@ponytail": false}`. Keeps it active
   everywhere else.
2. **Disconnect claude-in-chrome + computer-use for this project** (app UI):
   ~2.5k of instructions + deferred names; this repo verifies via
   Claude_Preview, not the Chrome extension.
3. Desktop-app built-ins (Claude_Preview/visualize/ccd_session schemas,
   built-in skills) are not configurable — that ~10k is the app's floor.
   For minimum-context sessions, use plain CLI `claude`.

## Phase 4 (optional, not fresh-load) — per-invoke costs

- `manage-site/SKILL.md` body: 18.8 KB ≈ ~4.9k tokens, loaded on nearly every
  working session. A later pass could tighten to ~13 KB — separate commit.
- `development.md` (59 KB) is on-demand and grep-navigable; rows 46/47 are
  ~10 KB combined but only paid when read. Leave.

## Verification

- Byte targets: `wc -c CLAUDE.md` ≤ 17,500; descriptions total ≤ 2.4 KB.
- `/context` before/after in a fresh session; expect repo bucket ~10.5k → ~5k.
- Fresh-agent test on three recent task shapes (a content edit, a CSS/layout
  change, a theme tweak): the trimmed CLAUDE.md must still route each to the
  right reference row on the first hop — no fact reachable only via deleted
  prose.
- Every **MOVE** item greppable in its new home before the old copy dies.

## Execution notes

- One docs commit (`docs: slim CLAUDE.md to invariants + pointers`), ask
  before committing (`AUTO_COMMIT_PUSH: false`); working tree currently has
  another session's uncommitted changes — don't mix them in.
- Zero render/behavior impact: docs + `.claude/` only.
