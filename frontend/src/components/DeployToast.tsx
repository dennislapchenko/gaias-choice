// One-line "your change is live" toast, fired when a Pages deploy that includes
// an editor's write goes live (deployWatch.ts). Self-dismisses after a beat, or
// on click. Mounted once at the app root (App.tsx); readers never trigger it.
import { useEffect, useState } from 'react'
import { onDeployLive } from '../lib/deployWatch'
import { useI18n } from '../lib/i18n'

export default function DeployToast() {
  const [show, setShow] = useState(false)
  const { t } = useI18n()
  useEffect(() => {
    let hide: number
    const off = onDeployLive(() => {
      setShow(true)
      window.clearTimeout(hide)
      hide = window.setTimeout(() => setShow(false), 8000)
    })
    return () => {
      off()
      window.clearTimeout(hide)
    }
  }, [])
  if (!show) return null
  return (
    <button type="button" className="deploy-toast" onClick={() => setShow(false)}>
      <span aria-hidden="true">✓</span> {t('editor.deployLive')}
    </button>
  )
}
