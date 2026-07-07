import { withBase } from '../lib/asset'
import { useI18n } from '../lib/i18n'

// Every bundled site image, by filename, listed at build time. Object.keys
// never invokes the glob loaders, so nothing here is imported or re-emitted —
// we only want the names to build `/images/<name>` URLs (resolved against BASE
// like every other asset). Reused by the avatar field and, later, post covers.
const IMAGES = Object.keys(
  import.meta.glob('/public/images/*.{webp,svg,png,jpg,jpeg}'),
)
  .map((p) => p.split('/').pop() as string)
  .sort()

// A modal grid of the site's images; clicking one hands its `/images/<name>`
// path back and closes. Presentational only — the caller owns what the path
// fills.
export default function ImagePicker({
  onPick,
  onClose,
}: {
  onPick: (path: string) => void
  onClose: () => void
}) {
  const { t } = useI18n()
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
          <button type="button" className="image-picker-close" onClick={onClose} aria-label={t('imagePicker.close')}>
            ×
          </button>
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
      </div>
    </div>
  )
}
