# Live-edit paths — editing any text zone in the browser, with YAML/markdown in git staying the source of truth

Goal: an admin/writer clicks ✎ on any text zone, edits in the popup, hits
Save — and the change lands **in the same `content/` YAML/markdown files
that already are the site**, not in a parallel store. This is the question
`context/backend/backend-paths.md` D5 said the portal must open with;
this doc answers it.

Short answer: **yes, there is a nice way** — because of a property this
site already has and most sites don't: *every visible string has exactly
one file+path home* (content-as-data). That makes the backend a
**git-writing editor**, not a CMS database. Nothing about the content
model changes; the portal becomes another way to produce commits.

## Decision (owner, 2026-07-06)

- **Path A picked; Path B explicitly rejected** after the availability
  discussion (a DB overlay means the live site either silently serves
  stale content or blocks on the BE — both unacceptable).
- Cross-cutting C1–C5 accepted as written; implementation scope is
  phases 1–3 of the recommendation (seam + Upcoming zone + draft flow),
  per `action-plan.md` next to this file. Owner ordered implementation
  directly — the action plan doubles as the executing agent's contract.

Everything below is the analysis the decision was based on.

## Where we stand (verified in the repo, not guessed)

1. **The editor UI shell exists** (in-flight, uncommitted):
   `src/lib/contentEditor.tsx` — `ContentEditorProvider` mounted at the app
   root with an `open({key, title, initialValue})` API, overlay + textarea
   + Save button (Save currently only closes — its comment says so: "no
   backend to write to"). `src/components/EditButton.tsx` — the reusable
   pencil button. Wired so far only into `Upcoming.tsx`.
2. **The Upcoming wiring is a *draft composer*, not an editor** — its ✎
   pre-fills the contribute template with the item's name/url (a "start
   writing this review/entry" flow). In-place editing of existing text is
   the same UI but a different data flow; both are covered below.
3. **Every text zone is addressable.** Everything rendered comes from
   `content/locales/<lng>/site.yaml` (a YAML path like
   `upcoming[2].name`), a frontmatter field, or a markdown body — file
   path + path-within-file is a complete, stable address.
4. **The FE already holds the raw file text** — `?raw` globs in
   `src/lib/content.ts` bundle every source file verbatim at build time,
   and the `yaml` package (existing dep) has a **comment- and
   format-preserving Document API** (`parseDocument` → set at path →
   `toString`). The FE can perform surgical YAML edits without a new dep.
5. **Publish already exists**: push to `main` → Pages workflow builds and
   deploys in ~1–2 min. A failed build (e.g. malformed YAML) fails the
   deploy and the live site stays on the last good version — the pipeline
   is its own backstop.
6. **The backend** (Go/gin + SQLite, `context/backend/`, built and
   verified) is local-only behind ngrok, with the D6 auth/roles design
   (admin/writer/reader) deferred but decided in shape.

## The paths

### Path A — Git-backed editing via the GitHub Contents API (recommended)

Save → `POST /api/content/save {path, content, sha}` → backend commits the
file to `main` through GitHub's REST Contents API → Pages rebuilds →
live in ~2 min.

- **The backend stays dumb and stateless**: validate (auth; path must be
  under `content/`; size cap), then one HTTPS call to GitHub with a
  fine-grained PAT scoped to this repo (contents: read/write). No git
  binary in the distroless image, no working checkout to keep in sync, no
  go-git dependency. GitHub remains the only source of truth.
- **Built-in conflict safety**: the Contents API requires the file's
  current blob `sha` on write and 409s on mismatch — optimistic
  concurrency for free. The FE fetches the *current* file
  (`GET /api/content/file?path=…`, backend proxies the read) before
  opening the editor, so edits never start from the stale built-in copy.
- **YAML surgery happens on the FE**, which already has the right tool:
  fetch fresh file → `yaml.parseDocument` → `setIn(path, newValue)` →
  `toString()` → send the whole updated file. Comments and formatting
  survive. Go-side YAML rewriting (yaml.v3 node juggling, weaker comment
  preservation, a new dep) is avoided entirely. Markdown bodies need no
  surgery — the popup edits the whole file text as-is.
- **Every edit is a commit** with the portal user as author
  (`content: edit site.yaml via portal` style) — audit trail, revert,
  blame, all inherited from git. The site's history stays one history.
- **The draft-composer flow unifies**: the same endpoint creates new files
  (Contents API create = PUT without sha), so "✎ on an Upcoming item →
  edit the pre-filled template → Save" can *create*
  `content/locales/en/products/<slug>.md` as a real draft commit.
  (Whether drafts go straight to `main` or to a branch/PR is a knob —
  see cross-cutting C4.)
- Cost: edits appear on the live site only after the ~1–2 min rebuild.
  The popup can reflect the save optimistically and show a "publishing…"
  state; for a content site edited by its owners, this is the honest
  publish latency, not a bug.

### Path B — DB overlay + runtime fetch (rejected)

Store edits in SQLite; the site fetches overrides at runtime and patches
them over the built-in content. Rejected: it forks the source of truth
(git says one thing, the live site another), breaks the
static-site-works-without-the-BE invariant for the *content itself*,
complicates the deferred prerender/SEO plan (crawlers would see stale
text), and turns the backend into the CMS database D5 warned about. The
only thing it buys — instant visibility — is worth less than what it
costs. DB-backed content stays right for *genuinely dynamic* data
(sessions, future orders/comments), which is what SQLite is there for.

### Path C — Hybrid: SQLite drafts, explicit publish-to-git (later, maybe)

Writers save drafts into SQLite (instant, private, no commits); an
explicit "Publish" (or an admin review step) flushes a draft through the
same Path-A write. This is a *workflow* layer on top of Path A, not an
alternative — worth considering when the 5 writers are real and want
draft privacy or admins want a review gate. Build A first; C reuses its
entire write path.

## Cross-cutting decisions

### C1 — Zone addressing must come from the content layer, not components

Replace the prototype's display key (`upcoming:${title}:${item.name}`)
with a real address: `{ file: 'content/locales/en/site.yaml',
path: ['upcoming', 2, 'name'] }`. Subtlety that forces this to live in
`src/lib/content.ts`: **locale fallback**. `getSite` shallow-merges `en`
into other locales and collections fall back per-slug — so the file that
*renders* a value in RU is often the EN file. Only the content layer
knows which file actually supplied each value; getters grow an optional
provenance channel (e.g. an `editRef(...)` lookup beside the data, only
populated in edit mode) and components never guess paths. Roll out zone
by zone — Upcoming first, matching the prototype.

### C2 — Edit mode is gated, and the write endpoint is auth-critical

A `PATCH`-capable backend holding a repo-write PAT **must never be
exposed unauthenticated — ngrok makes the API public while tunnelling.**
Minimum bar before the save endpoint exists at all: a single
`ADMIN_TOKEN` env check (bearer header, constant-time compare), entered
once in the FE and kept in memory/localStorage. Real sessions + the
admin/writer/reader roles (backend D6) replace it when the portal proper
lands; writers get `content/` writes, readers never see edit mode. The ✎
buttons render only when edit mode is on (authed + BE reachable), so the
public site ships zero editing chrome — same degradation rule as the rest
of the API surface.

### C3 — Validation & failure containment

FE re-parses its own YAML output before sending (the `yaml` dep is right
there); BE enforces auth, `content/`-only paths, and size caps — it does
not parse YAML (keeping zero new Go deps). The ultimate backstop is the
existing pipeline: a bad file fails the Pages build and the live site
stays on the last good deploy. Surfacing that (BE checks the commit's
workflow conclusion, or simply "check the Actions tab") is a
nice-to-have, not a launch gate.

### C4 — Commit target: `main` now, branch/PR later

Owner-edits commit straight to `main` (matching how the site ships
today). When writers are real, flip a config: writer saves target a
branch + PR, admins merge — the Contents API supports both; the endpoint
grows a `branch` knob, nothing else changes. This also gives Path C its
review gate almost for free.

### C5 — What the popup edits

Textarea over source text — a YAML scalar for field zones, the whole
file for markdown zones. No rich-text/inline-WYSIWYG layer; the owners
write markdown natively and the popup already matches this. (If a field
is one line, the popup shows one line — the `initialValue` is just the
current value, not the whole file, even though the whole file is what's
written back.)

## Recommendation

**Path A**, phased:

1. **Seam** (needs backend D6-minimum auth = the `ADMIN_TOKEN` gate):
   `GET /api/content/file` + `POST /api/content/save` proxying the GitHub
   Contents API; PAT via env; path allowlist; commit messages
   `content: … via portal`.
2. **First zone**: rewire the existing popup's Save for Upcoming item
   names — `site.yaml` path edit through the FE `yaml` Document surgery,
   409-retry on conflict. Proves string-level round-trip with comments
   intact.
3. **Draft flow**: the already-built template composer gains "Save as
   draft file" (create-file variant) — new reviews/journal drafts become
   real commits.
4. **Spread zones** via C1 provenance refs; then portal auth/roles
   replace the token (backend D6), and C4/C3 knobs as the writer group
   materializes.

Nothing here touches the content model, adds a runtime content
dependency, or creates a second source of truth: the portal is a pencil
that writes git commits.
