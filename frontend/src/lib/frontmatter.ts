// Structured frontmatter editing for the portal editor (Path C, see
// context/archive/editor-fields/). Parse a content file's `---` block to a `yaml`
// Document, edit one field, re-emit ONLY that block (comments + commented-out
// optional keys survive, since the Document API round-trips them) and splice the
// untouched body back byte-for-byte. Confirmed there are no block-scalar
// frontmatter values in the content, so `toString()` can't reflow anything.
//
// The whole-file text stays the single source of truth in contentEditor.tsx:
// fields are DERIVED by parsing it each render, and a field edit produces new
// text via setField — so the Fields tab and the Raw textarea never diverge.
import { isMap, isSeq, parseDocument } from 'yaml'

// Split a markdown file into its `---` frontmatter block and body, keeping the
// delimiters so the body splices back byte-for-byte (group 2 = the YAML lines
// with no leading/trailing delimiter or newline). Plain-YAML files (site.yaml)
// don't match — the caller treats the whole text as the document.
export const FRONTMATTER_RE = /^(---\r?\n)([\s\S]*?)(\r?\n---\r?\n?)([\s\S]*)$/

export type FieldType = 'string' | 'number' | 'boolean' | 'string[]' | 'number[]' | 'other'

export interface FrontmatterField {
  key: string
  value: string | number | boolean | string[] | number[] | null
  type: FieldType
}

export interface SplitFrontmatter {
  open: string
  yaml: string
  close: string
  body: string
}

export function splitFrontmatter(text: string): SplitFrontmatter | null {
  const m = FRONTMATTER_RE.exec(text)
  if (!m) return null
  return { open: m[1], yaml: m[2], close: m[3], body: m[4] }
}

function inferType(v: unknown): FieldType {
  if (typeof v === 'string') return 'string'
  if (typeof v === 'number') return 'number'
  if (typeof v === 'boolean') return 'boolean'
  if (Array.isArray(v)) {
    if (v.length > 0 && v.every((x) => typeof x === 'number')) return 'number[]'
    if (v.every((x) => typeof x === 'string')) return 'string[]' // [] defaults to string[]
    return 'other'
  }
  return 'other'
}

// Ordered field list parsed from a file's frontmatter (file key order
// preserved). Empty on no block / parse error — the caller falls back to the
// Raw tab so a malformed file is still editable.
export function parseFields(text: string): FrontmatterField[] {
  const fm = splitFrontmatter(text)
  const doc = parseDocument(fm ? fm.yaml : text)
  if (doc.errors.length > 0 || !isMap(doc.contents)) return []
  const out: FrontmatterField[] = []
  for (const item of doc.contents.items) {
    const key = String(item.key)
    const value = (item.value == null ? null : item.value.toJSON()) as FrontmatterField['value']
    out.push({ key, value, type: inferType(value) })
  }
  return out
}

// Whole-file text with ONE frontmatter field set to `newValue` (a JS
// value: string | number | boolean | string[] | number[]). Re-emits only the
// frontmatter block; arrays are forced back to single-line flow (`[a, b]`) to
// match the authored style. Throws on a malformed source block (caller keeps
// the old text + surfaces it).
export function setField(text: string, key: string, newValue: FrontmatterField['value']): string {
  const fm = splitFrontmatter(text)
  const doc = parseDocument(fm ? fm.yaml : text)
  if (doc.errors.length > 0) throw new Error(doc.errors[0].message)
  if (Array.isArray(newValue)) {
    // Build the seq with flow set BEFORE inserting (setting .flow on an
    // already-inserted node doesn't take) so `tags`/`scores` stay one line.
    const node = doc.createNode(newValue)
    if (isSeq(node)) node.flow = true
    doc.set(key, node)
  } else {
    doc.set(key, newValue)
  }
  // toString adds a trailing newline; the `close` delimiter already carries the
  // newline before `---`, so drop exactly one to avoid a blank line.
  // flowCollectionPadding:false ⇒ `[4, 5]` not `[ 4, 5 ]` (matches authored style).
  const block = doc.toString({ lineWidth: 0, flowCollectionPadding: false }).replace(/\n$/, '')
  return fm ? `${fm.open}${block}${fm.close}${fm.body}` : block
}

// Untrusted model output (the enrich composer) occasionally emits a key TWICE —
// e.g. a duplicated `tags:` line, sometimes in a stray language — which is
// invalid YAML: it blanks the Fields tab (parseFields errors → []), blocks
// saving (badFrontmatter), and would break the build loader if ever committed.
// Collapse duplicate keys to their LAST occurrence and re-emit. No-op (byte
// identical) when the block already parses clean, so healthy templates keep
// their comments/formatting untouched.
export function dedupeFrontmatter(text: string): string {
  const fm = splitFrontmatter(text)
  const source = fm ? fm.yaml : text
  if (parseDocument(source).errors.length === 0) return text // healthy → untouched
  const doc = parseDocument(source, { uniqueKeys: false })
  if (doc.errors.length > 0 || !isMap(doc.contents)) return text // not a dup-key problem — leave it
  const seen = new Set<string>()
  doc.contents.items = [...doc.contents.items]
    .reverse()
    .filter((item) => {
      const k = String(item.key)
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    .reverse()
  const block = doc.toString({ lineWidth: 0, flowCollectionPadding: false }).replace(/\n$/, '')
  return fm ? `${fm.open}${block}${fm.close}${fm.body}` : block
}

// Whole-file text with ONE frontmatter key removed entirely (no-op if absent).
// Used when clearing the cover or emptying the gallery so the block stays clean
// (`image: ''` / `gallery: []` left behind would be ugly). Same block-only
// re-emit + body splice as setField.
export function removeField(text: string, key: string): string {
  const fm = splitFrontmatter(text)
  const doc = parseDocument(fm ? fm.yaml : text)
  if (doc.errors.length > 0) throw new Error(doc.errors[0].message)
  doc.delete(key)
  const block = doc.toString({ lineWidth: 0, flowCollectionPadding: false }).replace(/\n$/, '')
  return fm ? `${fm.open}${block}${fm.close}${fm.body}` : block
}
