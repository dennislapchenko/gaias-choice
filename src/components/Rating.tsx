import { useI18n } from '../lib/i18n'

export default function Rating({ value }: { value: number }) {
  const { t } = useI18n()
  const full = Math.round(value)
  return (
    <span
      className="rating"
      aria-label={t('rating.ariaLabel', { value })}
      title={t('rating.title', { value })}
    >
      {'★'.repeat(full)}
      <span className="rating-empty">{'★'.repeat(5 - full)}</span>
    </span>
  )
}
