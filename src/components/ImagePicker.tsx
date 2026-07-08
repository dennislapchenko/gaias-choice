import { useRef, useState } from 'react'
import { withBase } from '../lib/asset'
import { useI18n } from '../lib/i18n'

// Every bundled site image, by filename, listed at build time. Object.keys
// never invokes the glob loaders, so nothing here is imported or re-emitted —
// we only want the names to build `/images/<name>` URLs (resolved against BASE
// like every other asset). Reused by the avatar field and post covers.
const IMAGES = Object.keys(
  import.meta.glob('/public/images/*.{webp,svg,png,jpg,jpeg}'),
)
  .map((p) => p.split('/').pop() as string)
  .sort()

// A modal grid of the site's images; clicking one hands its `/images/<name>`
// path back and closes. When `onUpload` is provided, a header "From your device"
// button opens the OS file dialog and commits the pick as a fresh file (onUpload
// resolves to its new `/images/<name>` path, which is then picked) — so the two
// sources sit side by side: the site's library (grid) and the local machine
// (button). Presentational otherwise — the caller owns what the path fills.
export default function ImagePicker({
  onPick,
  onClose,
  onUpload,
}: {
  onPick: (path: string) => void
  onClose: () => void
  onUpload?: (file: File) => Promise<string>
}) {
  const { t } = useI18n()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const upload = async (file: File) => {
    if (!onUpload) return
    setBusy(true)
    try {
      const path = await onUpload(file)
      onPick(path)
      onClose()
    } catch {
      setBusy(false) // stay open so the admin can retry / pick existing
    }
  }

  return (
    <div className="image-picker-backdrop" onClick={onClose}>
      <div
        className="image-picker"
        role="dialog"
        aria-label={t('imagePicker.title')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="image-picker-head">
          <p className="side-label">{t('imagePicker.title')}</p>
          <div className="image-picker-head-actions">
            {onUpload && (
              <button
                type="button"
                className="image-picker-upload"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
              >
                <span aria-hidden="true">⬆</span>
                {busy ? t('editor.imageUploading') : t('imagePicker.upload')}
              </button>
            )}
            <button type="button" className="image-picker-close" onClick={onClose} aria-label={t('imagePicker.close')}>
              ×
            </button>
          </div>
        </div>
        <div className="image-picker-grid">
          {IMAGES.map((name) => (
            <button
              key={name}
              type="button"
              className="image-picker-item"
              title={name}
              onClick={() => {
                onPick('/images/' + name)
                onClose()
              }}
            >
              <img src={withBase('/images/' + name)} alt={name} loading="lazy" />
            </button>
          ))}
        </div>
        {onUpload && (
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) upload(f)
            }}
          />
        )}
      </div>
    </div>
  )
}
