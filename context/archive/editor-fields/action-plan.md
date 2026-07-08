# Structured frontmatter editor — action plan (Path C)

Chosen: **Path C** — parse the `---` block to a `yaml` `Document`, edit nodes,
`toString()` the block back, splice the body verbatim. Dynamic parse-driven
fields + light hint widgets + a Raw-tab escape hatch. Body stays a textarea.

Single source of truth stays `state.value` (the whole file text). Fields are
**derived by parsing `value` each render**; a field edit produces a new `value`
by re-emitting the frontmatter block. The Raw tab edits `value` directly. So
fields ⇄ raw are always consistent, and this session's autosave / dirty /
close-guard keep working unchanged (they key off `value`).

## Two semantic guards (decided up front)

- **`state` is NOT an editable field here.** State changes must go through
  `setPostState` (the toggle), which also drives the RU→EN translation +
  single-commit sibling write. A structured field that writes `state:` directly
  would bypass that contract. Render it **read-only** (or omit) in the field
  list; the toggle on the detail page stays the only way to flip it.
- **`translatedFrom` is read-only** (a provenance mark owned by the translation
  flow). Show it disabled, or hide it.

## Steps

1. **`src/lib/frontmatter.ts` (new, small).** Move `FRONTMATTER_RE` here
   (re-import in `contentEditor.tsx`). Add:
   - `splitFrontmatter(text)` → `{ open, yaml, close, body } | null`.
   - `parseFields(yaml)` → ordered `{ key, value, type }[]` where `type` is
     inferred from the parsed node (`string | number | boolean | string[] |
     number[] | other`). Preserves file key order.
   - `setField(text, key, newValue)` → new whole-file text: parse the block to a
     `Document`, `doc.set(key, newValue)` (or `setIn` for array items), re-emit
     the block with `{ lineWidth: 0 }`, splice body back. Comments survive
     (Document re-emits them).
   - **Success:** a unit self-check (`frontmatter.test`-style `demo()` or a tiny
     assert block) round-trips a sample review's frontmatter: edit `title` +
     `scores[2]`, assert comments and the untouched keys/body survive.
2. **`src/components/FrontmatterFields.tsx` (new).** Given the current `value`
   and an `onEdit(key, newValue)` callback, render one control per parsed field:
   - `date` → `<input type=date>`; `excerpt` → `<textarea>`; number → number
     input; `string[]` (tags) → comma-separated text input ↔ array; `number[]`
     (`scores`) → a labelled 0–5 row, labels from `getSite(locale).ratingCriteria.items`
     (fallback to index); `state`/`translatedFrom` → read-only; everything else
     → text input. Labels: a small hint map (`editor.field.<key>` i18n with a
     humanized fallback for unknown keys).
   - **Success:** every key in a sample file renders a sensibly-typed control;
     an unknown/new key renders a text input (dynamic requirement met).
3. **Wire the Fields tab into `contentEditor.tsx`.** Add a third tab:
   **Fields | Write | Raw** (Write = body preview stays; Raw = today's full-text
   textarea, still `frontmatterError`-guarded). Fields tab renders
   `<FrontmatterFields value={state.value} onEdit={...}>`; `onEdit` calls
   `setField` and `setState({...state, value})`. Body textarea (Write) edits the
   body only via a body-splice helper (or keep the existing whole-text textarea
   as Raw and add a body-only textarea for Write — decide during impl; simplest:
   Write stays body-preview, Raw stays whole-text edit, Fields edits frontmatter).
   - **Success:** editing a field updates the raw text (visible when you switch
     to Raw); editing raw updates the fields (switch back); save commits the
     combined text.
4. **Optional-absent keys.** A tiny per-kind hint list (`affiliateUrl`, `image`)
   so a known-but-unset optional field can show as an empty input; setting it
   `doc.set`s a fresh key (the commented template line stays as a comment).
   `image` already has the cover strip — don't duplicate; this is mainly
   `affiliateUrl`. Low priority; can ship after 1–3.
5. **Styles** (`styles.css`): `.ce-fields` grid, `.ce-field` row (label +
   control), `.ce-scores` row. Reuse existing input styling from `.create-field`
   / `.field*` where possible.
6. **i18n**: `editor.fields`, `editor.raw` tab labels; `editor.field.<key>`
   labels for the known keys (en+ru).
7. **Docs**: update the Live-edit row in `references/development.md` + the
   editor paragraph in `CLAUDE.md` (Fields/Write/Raw tabs; `frontmatter.ts`;
   the `state`-not-editable-here rule).

## Verify

- `task typecheck && task build` after each of steps 1–3.
- The `frontmatter.ts` self-check (step 1) is the load-bearing logic test.
- Live editor click-through is login-gated (editor session + backend) — flag it;
  do it on the dev stack if a session is available.

## Risk / churn

- `Document.toString()` re-emits *changed* nodes in the library's default style
  (e.g. a quoted title may lose quotes when the value is plain) — YAML-valid and
  parsed fine by `content.ts`; churn is bounded to edited fields. Confirmed no
  block scalars exist, so nothing reflows. Accept.
- Keep the Raw tab as the escape hatch for anything the field UI can't model.
