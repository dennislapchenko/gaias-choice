// Delete a review/journal content file outright, with an "are you sure?"
// confirm dialog (reusing the content-editor overlay look). Lives next to
// StateToggle/EditButton in .detail-nav-tools; on success there's nothing
// left to show, so it navigates back to the listing.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCmdEnter } from '../lib/cmdEnter'
import { useContentEditor } from '../lib/contentEditor'
import { useI18n } from '../lib/i18n'

export default function DeleteButton({ path, redirectTo }: { path: string; redirectTo: string }) {
  const editor = useContentEditor()
  const navigate = useNavigate()
  const { t } = useI18n()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirm = () => {
    if (busy) return
    setBusy(true)
    setError(null)
    editor
      .deleteFile(path)
      .then(() => navigate(redirectTo))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err))
        setBusy(false)
      })
  }

  // Cmd/Ctrl+Enter confirms the delete while the yes/no dialog is open.
  useCmdEnter(confirm, confirming && !busy)

  return (
    <>
      <button
        type="button"
        className="edit-btn delete-btn"
        aria-label={t('editor.deleteAria')}
        title={t('editor.deleteAria')}
        onClick={() => setConfirming(true)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 7h16" />
          <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
        </svg>
      </button>
      {confirming && (
        <div className="confirm-overlay" onClick={() => !busy && setConfirming(false)}>
          <div
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-label={t('editor.deleteConfirmTitle')}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="confirm-dialog-title">{t('editor.deleteConfirmTitle')}</p>
            <p className="confirm-dialog-body">{t('editor.deleteConfirmBody')}</p>
            {error && (
              <p className="confirm-dialog-error">
                {t('editor.deleteError')} {error}
              </p>
            )}
            <div className="confirm-dialog-actions">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy}
                onClick={() => setConfirming(false)}
              >
                {t('editor.cancel')}
              </button>
              <button type="button" className="btn btn-danger" disabled={busy} onClick={confirm}>
                {busy ? t('editor.deleting') : t('editor.confirmDelete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
