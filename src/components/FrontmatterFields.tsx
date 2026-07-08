// Structured frontmatter editing (Path C — see context/editor-fields/). Renders
// one control per key ACTUALLY present in the file's `---` block (dynamic: a new
// key shows up as a new input, no code change), widget inferred from the parsed
// value's type with a few key-specific niceties (date picker, per-criterion
// scores, excerpt textarea). Edits round-trip through `setField`, so the whole
// file text (owned by contentEditor) stays the single source of truth and the
// Fields tab never diverges from the Raw textarea.
//
// `state` and `translatedFrom` are shown READ-ONLY on purpose: `state` must be
// flipped through the StateToggle (which drives the RU→EN translation + the
// single-commit sibling write — a raw `state:` write would bypass that), and
// `translatedFrom` is a provenance mark owned by the translation flow.
import { useState } from 'react'
import { parseFields, type FrontmatterField } from '../lib/frontmatter'

const READONLY = new Set(['state', 'translatedFrom'])

const parseTags = (s: string): string[] =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)

// A comma-separated tags input with its OWN text buffer so typing a comma to
// start a second tag isn't eaten by the value↔array round-trip (the parent
// re-serializes on every keystroke; a plain controlled input would fight it).
// Seeded once; this input is the only editor of the field, and a tab switch
// remounts it, so it never needs to resync from props.
function TagsField({
  value,
  disabled,
  onCommit,
}: {
  value: string[]
  disabled?: boolean
  onCommit: (arr: string[]) => void
}) {
  const [text, setText] = useState(value.join(', '))
  return (
    <input
      type="text"
      value={text}
      disabled={disabled}
      onChange={(e) => {
        setText(e.target.value)
        onCommit(parseTags(e.target.value))
      }}
    />
  )
}

// title → "Title", affiliateUrl → "Affiliate Url", translatedFrom → "Translated
// From" — a dynamic label so unknown/new keys still read sensibly (no per-key
// i18n to keep in sync).
const humanize = (k: string) =>
  k.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase())

const clampScore = (v: number) => Math.max(0, Math.min(5, Math.round(v || 0)))

export default function FrontmatterFields({
  value,
  scoreLabels,
  disabled,
  hide,
  onEdit,
}: {
  value: string
  scoreLabels: string[]
  disabled?: boolean
  hide?: string[] // keys edited elsewhere (e.g. `image` via the cover strip)
  onEdit: (key: string, next: FrontmatterField['value']) => void
}) {
  const fields = parseFields(value).filter((f) => !hide?.includes(f.key))
  if (fields.length === 0) return null // malformed / no frontmatter — caller keeps the Raw tab

  return (
    <div className="ce-fields">
      {fields.map((f) => {
        const label = humanize(f.key)

        // scores: a labelled 0–5 number per criterion (site.yaml ratingCriteria).
        if (f.type === 'number[]' && f.key === 'scores') {
          const arr = (f.value as number[]) ?? []
          return (
            <div className="ce-field ce-field-block" key={f.key}>
              <span className="ce-field-label">{label}</span>
              <div className="ce-scores">
                {arr.map((n, i) => (
                  <label key={i} className="ce-score">
                    <span>{scoreLabels[i] ?? `#${i + 1}`}</span>
                    <input
                      type="number"
                      min={0}
                      max={5}
                      value={n}
                      disabled={disabled}
                      onChange={(e) => {
                        const next = arr.slice()
                        next[i] = clampScore(Number(e.target.value))
                        onEdit('scores', next)
                      }}
                    />
                  </label>
                ))}
              </div>
            </div>
          )
        }

        if (READONLY.has(f.key)) {
          return (
            <label className="ce-field" key={f.key}>
              <span className="ce-field-label">{label}</span>
              <input type="text" value={String(f.value ?? '')} readOnly disabled />
            </label>
          )
        }

        let control
        if (f.type === 'string[]') {
          control = (
            <TagsField
              value={(f.value as string[]) ?? []}
              disabled={disabled}
              onCommit={(arr) => onEdit(f.key, arr)}
            />
          )
        } else if (f.type === 'number') {
          control = (
            <input
              type="number"
              value={String(f.value ?? '')}
              disabled={disabled}
              onChange={(e) => onEdit(f.key, Number(e.target.value) || 0)}
            />
          )
        } else if (f.type === 'boolean') {
          control = (
            <input
              type="checkbox"
              checked={!!f.value}
              disabled={disabled}
              onChange={(e) => onEdit(f.key, e.target.checked)}
            />
          )
        } else if (f.key === 'date') {
          control = (
            <input
              type="date"
              value={String(f.value ?? '')}
              disabled={disabled}
              onChange={(e) => onEdit(f.key, e.target.value)}
            />
          )
        } else if (f.key === 'excerpt') {
          control = (
            <textarea
              value={String(f.value ?? '')}
              rows={2}
              disabled={disabled}
              onChange={(e) => onEdit(f.key, e.target.value)}
            />
          )
        } else {
          control = (
            <input
              type="text"
              value={String(f.value ?? '')}
              disabled={disabled}
              onChange={(e) => onEdit(f.key, e.target.value)}
            />
          )
        }
        return (
          <label className="ce-field" key={f.key}>
            <span className="ce-field-label">{label}</span>
            {control}
          </label>
        )
      })}
    </div>
  )
}
