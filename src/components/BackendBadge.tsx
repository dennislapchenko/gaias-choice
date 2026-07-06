import { useApi, type HelloResponse } from '../lib/api'
import { useI18n } from '../lib/i18n'

/**
 * Proof-of-seam consumer: renders a small unobtrusive line ONLY when the
 * backend answers `/api/hello`. When the BE is absent (the usual case, and
 * every production Pages build without VITE_API_URL), it renders null — the
 * static site stays byte-identical. A scaffold, like the Journal seed entry,
 * to be replaced by the first real portal feature.
 */
export default function BackendBadge() {
  const { t } = useI18n()
  const { data } = useApi<HelloResponse>('/hello')
  if (!data) return null
  return (
    <p className="backend-badge muted" aria-live="polite">
      <span className="backend-badge-dot" aria-hidden="true">
        ●
      </span>{' '}
      {t('backend.connected', { hits: data.hits })}
    </p>
  )
}
