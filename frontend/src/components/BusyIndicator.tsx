// A single light foreground spinner pinned to the corner of the screen while
// any content mutation is in flight (see api.ts useBusy) — the shared feedback
// for editor writes that otherwise commit silently: state flips, deletes, image
// uploads/reframes, and dialog saves. Mounted once at the app root (App.tsx).
import { useBusy } from '../lib/api'
import { useI18n } from '../lib/i18n'

export default function BusyIndicator() {
  const busy = useBusy()
  const { t } = useI18n()
  if (!busy) return null
  return (
    <div className="busy-indicator" role="status" aria-live="polite">
      <span className="busy-indicator-spinner" aria-hidden="true" />
      {t('editor.saving')}
    </div>
  )
}
