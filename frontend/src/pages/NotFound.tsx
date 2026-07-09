import { Link } from 'react-router-dom'
import { usePageHead } from '../lib/head'
import { useI18n } from '../lib/i18n'

export default function NotFound() {
  const { t } = useI18n()
  usePageHead(t('notFound.title'))
  return (
    <div className="detail center">
      <h1>{t('notFound.title')}</h1>
      <p className="muted">{t('notFound.body')}</p>
      <Link to="/" className="btn btn-primary">
        {t('notFound.backHome')}
      </Link>
    </div>
  )
}
