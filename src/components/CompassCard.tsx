import { Link } from 'react-router-dom'
import type { CompassEntry } from '../lib/types'
import { withBase } from '../lib/asset'
import { useI18n } from '../lib/i18n'

// Vertical card used only for the homepage "New on the Compass" teaser (the
// /compass listing itself uses the fatter CompassRow).
export default function CompassCard({ entry }: { entry: CompassEntry }) {
  const { t } = useI18n()
  return (
    <article className="card">
      <div className="card-media">
        {entry.image ? (
          <img src={withBase(entry.image)} alt={entry.title} loading="lazy" />
        ) : (
          <div className="card-media placeholder" aria-hidden="true">
            📋
          </div>
        )}
      </div>
      <div className="card-body">
        <div className="card-tags">
          <span className="tag">{t('compass.tag')}</span>
          {entry.chapter != null && (
            <span className="tag">{t('compass.chapter', { n: entry.chapter })}</span>
          )}
          {entry.tags?.map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>
        <h3>
          <Link to={`/compass/${entry.slug}`} className="card-link">
            {entry.title}
          </Link>
        </h3>
        <p className="muted">{entry.excerpt}</p>
      </div>
    </article>
  )
}
