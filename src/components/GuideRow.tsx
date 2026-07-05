import { Link } from 'react-router-dom'
import type { Guide } from '../lib/types'
import { withBase } from '../lib/asset'
import { useI18n } from '../lib/i18n'

// A fat horizontal bar (see `.guide-row` in styles.css) used for the epic
// listing on /guides — distinct from the vertical GuideCard used on the
// homepage teaser. Corner-anchored labels over a full-bleed image: the
// "Guide" tag top left, chapter number top right, title bottom left,
// excerpt bottom right.
export default function GuideRow({ guide }: { guide: Guide }) {
  const { t } = useI18n()
  return (
    <article className="guide-row">
      {guide.image ? (
        <img className="guide-row-img" src={withBase(guide.image)} alt="" loading="lazy" />
      ) : (
        <div className="guide-row-img placeholder" aria-hidden="true">
          📋
        </div>
      )}
      <span className="tag guide-row-tag">{t('guides.tag')}</span>
      {guide.chapter != null && (
        <span className="tag guide-row-chapter">{t('guides.chapter', { n: guide.chapter })}</span>
      )}
      <h3 className="guide-row-title">
        <Link to={`/guides/${guide.slug}`} className="card-link">
          {guide.title}
        </Link>
      </h3>
      <p className="guide-row-excerpt">{guide.excerpt}</p>
    </article>
  )
}
