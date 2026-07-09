// iPhone-style switch that flips a post's `state` directly (no dialog) via
// contentEditor's setPostState — which also propagates to the EN sibling
// (flipping an RU post Active (re)translates it to EN; Upcoming just mirrors the
// state). `active` = ON (right, filled); `upcoming` = OFF.
import { useState } from 'react'
import { useContentEditor } from '../lib/contentEditor'
import { useI18n } from '../lib/i18n'
import type { EditRef, PostState } from '../lib/types'

export default function StateToggle({
  value,
  file,
  onChanged,
}: {
  value: PostState | undefined
  file: string
  onChanged: (v: PostState) => void
}) {
  const editor = useContentEditor()
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const active = value !== 'upcoming'

  const flip = () => {
    if (busy) return
    const next: PostState = active ? 'upcoming' : 'active'
    const ref: EditRef = { file, path: ['state'] }
    setBusy(true)
    setError(null)
    setSaved(false)
    editor
      .setPostState(ref, next)
      .then(() => {
        onChanged(next)
        // The optimistic toggle flips instantly, but the built site only catches
        // up after the deploy — say so, so a reload-in-between doesn't read as
        // "my change vanished".
        setSaved(true)
        window.setTimeout(() => setSaved(false), 4000)
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setBusy(false))
  }

  return (
    <span className="state-toggle">
      <button
        type="button"
        role="switch"
        aria-checked={active}
        aria-label={t('editor.stateAria')}
        title={t('editor.stateAria')}
        className={`state-switch${active ? ' is-on' : ''}`}
        disabled={busy}
        onClick={flip}
      >
        <span className="state-switch-knob" />
      </button>
      <span className="state-toggle-label">{busy ? t('editor.stateSyncing') : t('editor.stateLabel')}</span>
      {saved && !error && <span className="state-toggle-saved">{t('editor.published')}</span>}
      {error && <span className="state-toggle-error">{error}</span>}
    </span>
  )
}
