import { Link } from 'react-router-dom'
import type { Guide } from '../lib/types'
import { withBase } from '../lib/asset'
import { useI18n } from '../lib/i18n'

export default function GuideCard({ guide }: { guide: Guide }) {
  const { t } = useI18n()
  return (
    <article className="card">
      <div className="card-media">
        {guide.image ? (
          <img src={withBase(guide.image)} alt={guide.title} loading="lazy" />
        ) : (
          <div className="card-media placeholder" aria-hidden="true">
            📋
          </div>
        )}
      </div>
      <div className="card-body">
        <span className="tag">{t('guides.tag')}</span>
        <h3>
          <Link to={`/guides/${guide.slug}`} className="card-link">
            {guide.title}
          </Link>
        </h3>
        <p className="muted">{guide.excerpt}</p>
      </div>
    </article>
  )
}
