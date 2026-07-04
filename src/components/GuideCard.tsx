import { Link } from 'react-router-dom'
import type { Guide } from '../lib/types'
import { withBase } from '../lib/asset'

export default function GuideCard({ guide }: { guide: Guide }) {
  return (
    <article className="card">
      <Link to={`/guides/${guide.slug}`} className="card-media">
        {guide.image ? (
          <img src={withBase(guide.image)} alt={guide.title} loading="lazy" />
        ) : (
          <div className="card-media placeholder" aria-hidden="true">
            📋
          </div>
        )}
      </Link>
      <div className="card-body">
        <span className="tag">Guide</span>
        <h3>
          <Link to={`/guides/${guide.slug}`}>{guide.title}</Link>
        </h3>
        <p className="muted">{guide.excerpt}</p>
      </div>
    </article>
  )
}
