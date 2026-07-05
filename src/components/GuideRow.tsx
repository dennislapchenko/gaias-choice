import { Link } from 'react-router-dom'
import type { Guide } from '../lib/types'
import { withBase } from '../lib/asset'
import { useI18n } from '../lib/i18n'

// A fat horizontal bar (see `.guide-row` in styles.css) used for the epic
// listing on /guides — distinct from the vertical GuideCard used on the
// homepage teaser. Corner-anchored labels over a full-bleed image: the
// "Guide" tag top left, chapter number top right, title bottom left,
// excerpt bottom right. The whole bar is the link itself (not a nested
// `.card-link` overlay) because the title box is position:absolute for
// corner placement, which would otherwise become the containing block for
// an `::after` overlay and shrink the click target down to just the title.
export default function GuideRow({ guide }: { guide: Guide }) {
  const { t } = useI18n()
  return (
    <Link to={`/guides/${guide.slug}`} className="guide-row">
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
      <h3 className="guide-row-title">{guide.title}</h3>
      <p className="guide-row-excerpt">{guide.excerpt}</p>
    </Link>
  )
}
