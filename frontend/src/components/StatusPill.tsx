// The single foreground pill that carries an editor's write through its whole
// lifecycle — Saving… (request in flight) → Publishing… (committed, waiting on the
// Pages deploy) → ✓ Live — and, being mounted once above <Routes> in App.tsx,
// survives the navigation a delete/redirect triggers. Readers never see any of it
// (nothing mutates without an authed session). One pill, never two: the busy phase
// takes priority over the deploy phase so a new write can't stack a second pill.
import { useBusy } from '../lib/api'
import { dismissDeploy, useDeployState } from '../lib/deployWatch'
import { useI18n } from '../lib/i18n'

export default function StatusPill() {
  const busy = useBusy()
  const deploy = useDeployState()
  const { t } = useI18n()

  if (busy || deploy === 'publishing') {
    return (
      <div className="busy-indicator" role="status" aria-live="polite">
        <span className="busy-indicator-spinner" aria-hidden="true" />
        {busy ? t('editor.saving') : t('editor.publishing')}
      </div>
    )
  }
  if (deploy === 'live') {
    return (
      <button type="button" className="deploy-toast" onClick={dismissDeploy}>
        <span aria-hidden="true">✓</span> {t('editor.deployLive')}
      </button>
    )
  }
  return null
}
