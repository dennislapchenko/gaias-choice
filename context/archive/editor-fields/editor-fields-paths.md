# Structured frontmatter editor — options

**Goal.** In the portal content editor (`src/lib/contentEditor.tsx`), stop
making the author hand-edit raw YAML frontmatter in the same textarea as the
body. Instead: **pre-parse the frontmatter and render one labelled input per
field**, so the fields are impossible to break as YAML. The markdown **body
stays a plain textarea** (it's just `.md` — hard to break, and the
Write/Preview tab already covers it). Fields should be **dynamic** — driven by
whatever keys the file actually has, so a new frontmatter key shows up as a new
input without a code change.

## Current state (verified in the repo, 2026-07-08)

- `openFile` loads a content file's **whole raw text** (frontmatter + body)
  into one `<textarea>`. `FRONTMATTER_RE` already splits `[, open, yaml, close,
  body]`. Scalar edits (state toggle, cover image) go through
  `applyScalarEdit`/`editYamlScalar` — **CST-level, byte-preserving** surgery
  that changes only the one edited scalar's line and **inserts a top-level key
  if absent**. This is load-bearing (CLAUDE.md): the `yaml` Document API
  re-folds long block scalars, so they use the CST path deliberately.
- As of this session the raw save path is **YAML-guarded** (`frontmatterError`)
  and the editor **autosaves + guards close** — so the raw editor is safe, just
  not friendly.

### The frontmatter we actually have (all three kinds)

| Key | Type | Notes |
| --- | --- | --- |
| `title` | string (quoted) | every kind |
| `excerpt` | string (long, quoted) | reviews/journal/compass |
| `date` | string `YYYY-MM-DD` | every kind — native `<input type=date>` fits |
| `state` | string enum `active`/`upcoming` | reviews/journal, optional (absent = active) |
| `category` | string enum | reviews — inline comment lists the allowed set |
| `scores` | **number[]** | reviews — index-aligned to `site.yaml` `ratingCriteria.items` |
| `tags` | **string[]** | every kind, single-line flow (`[travel]`) |
| `price` | string (quoted) | reviews |
| `affiliateUrl` | string | reviews — usually **commented-out** until enrolled |
| `image` | string path | optional, often **commented-out** |
| `chapter` | number | compass |
| `translatedFrom` | string | EN siblings only (provenance mark) |

### Two wrinkles that decide the design

1. **Comments are load-bearing.** Templates carry inline hints
   (`category: Sleep  # Sleep | Feeding | Care | …`) and **commented-out
   optional keys** (`# affiliateUrl: …`, `# image: …`) that tell the author the
   allowed values / what's available to set. Any approach that parses to a plain
   object and re-`stringify`s the frontmatter **destroys these** — so naive
   re-serialization is off the table.
2. **Two array fields** (`scores`, `tags`) are single-line flow sequences. The
   existing CST surgery only edits **scalars** — arrays are the one genuinely
   new mechanic.

## Cross-cutting decisions (apply to whichever path)

- **Body untouched.** Split on `FRONTMATTER_RE`; edit fields structurally,
  splice the body back byte-for-byte. Keep the existing body textarea +
  Write/Preview tab.
- **Dynamic, parse-driven fields + light hints.** Render an input for **every
  key present in the file** (so new keys appear for free), with the **widget
  inferred from the parsed value's type** (string→text, number→number,
  boolean→checkbox, array→list). Layer an *optional* tiny hint map for the few
  fields that deserve better than generic: `date`→date picker, `excerpt`→
  textarea, `scores`→per-criterion 0–5 row labelled from `site.yaml`
  `ratingCriteria`, `state`→the existing toggle semantics, `category`→a
  `<select>` seeded from the inline-comment enum (or free text if no hint).
  Unknown/new keys always fall back to a text input — never hidden.
- **Commented-out optional keys → empty optional fields.** Surface known-but-
  unset fields (e.g. `affiliateUrl`, `image`) as empty inputs; setting one
  inserts/uncomments the key (the CST insert-if-absent path already does this
  for scalars).
- **Keep a "Raw" tab.** A third tab beside Write/Preview that shows today's
  full-text textarea, for power edits / anything the field UI can't express.
  It stays behind the `frontmatterError` save-guard. This is the escape hatch
  that lets us ship the field UI for the *common* fields without having to
  perfectly model *every* possible YAML shape.

## Paths

### Path A — Per-field CST surgery (extend what exists) — *recommended*
Render fields dynamically; on each field change, apply a **targeted CST edit**
to just that key's line, reusing `applyScalarEdit` for scalars and a small new
helper for the two array fields (regenerate only the `key: [ … ]` line —
they're always single-line flow, so a bounded line-level replacement is safe
and comment-preserving). Insert-if-absent handles setting optional keys.
- **Pros:** preserves comments + commented-out keys **byte-for-byte**; stays on
  the house-blessed CST path; smallest, cleanest diffs on save; no risk to the
  body block scalars. Arrays are the only new code.
- **Cons:** array editing via CST/line-replacement is fiddly to get right for
  edge cases (empty `[]`, quoting inside `tags`); multi-line/block frontmatter
  values (none today) wouldn't be field-editable — they'd need the Raw tab.

### Path B — Whole-frontmatter object re-serialize
Parse the frontmatter to a JS object, edit via widgets, `yaml.stringify` the
frontmatter block back (body spliced verbatim).
- **Pros:** trivial to implement; arrays/dynamic keys are free.
- **Cons:** **destroys inline comments and commented-out optional keys** (wrinkle
  #1) — a real regression for the template-driven authoring flow; also churns
  quoting/key-order/formatting on every save (noisy diffs). **Rejected** unless
  we accept losing the template hint comments.

### Path C — `yaml` Document node edits + `toString()`
Parse to a `Document`, set values on nodes, `doc.toString()`. Preserves
comments better than Path B (per-node).
- **Pros:** comment-aware; arrays handled natively by the Document API; less
  fiddly than CST for arrays.
- **Cons:** CLAUDE.md explicitly avoids `Document.toString()` because it
  **re-folds long block scalars** — needs verification that *frontmatter-only*
  (body excluded) has no long block scalars today (samples suggest it doesn't:
  `excerpt` is a single quoted line). If that holds, the block-scalar objection
  is moot for the frontmatter block and this becomes viable and simpler than A
  for arrays. Risk: a future long `excerpt`/block value would silently reflow.

### Path D — Schema-first (per-kind field definitions)
Define a field schema per content kind (labels, widgets, order, enums) in one
place; render from schema.
- **Pros:** best-looking, ordered, fully-labelled UI; scores/category get
  first-class widgets.
- **Cons:** **not dynamic** — a new frontmatter key needs a schema edit, which
  contradicts the "shows new stuff automatically" ask. Only acceptable if
  combined with a generic fallback for unknown keys (i.e. it collapses into the
  "light hints" idea already folded into the cross-cutting decisions).

## Resolved: no block scalars anywhere

Grepped every content file's frontmatter (2026-07-08): **no `|`/`>` block
scalars, no multi-line values** — all 12 keys hold single-line scalars or
single-line flow arrays. This **removes Path C's only real objection** (the
block-scalar refold). Both A and C preserve comments and commented-out keys
(the `yaml` Document API re-emits comments); the difference is now just diff
fidelity vs. code volume.

## Recommendation

The pick is **A vs C**, and with block scalars ruled out it leans **C**:

- **Path C (lean pick):** parse the frontmatter block to a `yaml` `Document`,
  set values on nodes, `doc.toString()` the block back. Handles `scores`/`tags`
  arrays and dynamic keys **natively**, preserves comments, and — since there
  are no block scalars — carries no refold risk. Least code. Only cost: an
  edited field re-emits in the library's default style (minor quoting/format
  churn on *changed* fields only; unchanged fields and the body are untouched).
- **Path A (conservative fallback):** stay on the CST per-scalar path for
  byte-perfect diffs even on unchanged fields, and write one small array helper.
  Choose this only if the tiny formatting churn on edited fields in C bothers us.

Everything else (dynamic parse-driven fields, the light hint map, commented-out
keys as optional fields, body-as-textarea, the Raw-tab escape hatch) is
identical either way.

## Next step

Owner picks A or C (or alters). Then I write `context/editor-fields/action-plan.md`
(numbered steps, files touched, success criteria) and only execute after you
agree to it.
