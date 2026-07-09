import { Link } from 'react-router-dom'
import type { CompassEntry } from '../lib/types'
import { withBase } from '../lib/asset'
import { useI18n } from '../lib/i18n'

// A fat horizontal bar (see `.guide-row` in styles.css) used for the epic
// listing on /compass — distinct from the vertical CompassCard used on the
// homepage teaser. Corner-anchored labels over a full-bleed image: the
// "Guide" tag top left, chapter number top right, title bottom left,
// excerpt bottom right. The whole bar is the link itself (not a nested
// `.card-link` overlay) because the title box is position:absolute for
// corner placement, which would otherwise become the containing block for
// an `::after` overlay and shrink the click target down to just the title.
export default function CompassRow({ entry }: { entry: CompassEntry }) {
  const { t } = useI18n()
  return (
    <Link to={`/compass/${entry.slug}`} className="guide-row">
      {entry.image ? (
        <img className="guide-row-img" src={withBase(entry.image)} alt="" loading="lazy" />
      ) : (
        <div className="guide-row-img placeholder" aria-hidden="true">
          📋
        </div>
      )}
      <span className="tag guide-row-tag">{t('compass.tag')}</span>
      {entry.chapter != null && (
        <span className="tag guide-row-chapter">{t('compass.chapter', { n: entry.chapter })}</span>
      )}
      <h3 className="guide-row-title">{entry.title}</h3>
      <p className="guide-row-excerpt">{entry.excerpt}</p>
    </Link>
  )
}
