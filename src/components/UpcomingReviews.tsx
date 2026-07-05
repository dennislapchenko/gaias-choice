import { useI18n } from '../lib/i18n'
import type { UpcomingItem } from '../lib/types'

/**
 * The "in the works" strip on /reviews: a flat list of rectangles, one per
 * review we've queued but not written yet. Each links out to the product's
 * listing (Amazon, for now — stored in `site.yaml` `upcoming:`). Deliberately
 * NOT presented as a review: no rating, no verdict, no affiliate tag.
 */
export default function UpcomingReviews({ items }: { items: UpcomingItem[] }) {
  const { t } = useI18n()
  if (items.length === 0) return null

  return (
    <section className="upcoming" aria-label={t('reviews.upcomingTitle')}>
      <p className="side-label upcoming-label">{t('reviews.upcomingTitle')}</p>
      <p className="upcoming-note">{t('reviews.upcomingNote')}</p>
      <ul className="upcoming-list">
        {items.map((item) => (
          <li key={item.name} className="upcoming-item">
            <a className="upcoming-link" href={item.url} target="_blank" rel="noopener noreferrer">
              <span className="upcoming-name">{item.name}</span>
              <span className="upcoming-arrow" aria-hidden="true">↗</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
