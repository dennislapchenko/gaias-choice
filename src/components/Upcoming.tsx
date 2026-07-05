import type { UpcomingItem } from '../lib/types'

/**
 * The "in the works" rail shared by /reviews and /journal: a flat list of
 * rectangles, one per queued-but-not-written item. Title/note come from the
 * caller (each page has its own strings). An item with a `url` links out
 * (reviews → the product's Amazon listing); without one it's a plain row
 * (journal entry ideas have nowhere to link yet). Deliberately NOT presented
 * as real content: no rating, no date, no verdict.
 */
export default function Upcoming({
  title,
  note,
  items,
}: {
  title: string
  note: string
  items: UpcomingItem[]
}) {
  if (items.length === 0) return null

  return (
    <section className="upcoming" aria-label={title}>
      <p className="side-label upcoming-label">{title}</p>
      <p className="upcoming-note">{note}</p>
      <ul className="upcoming-list">
        {items.map((item) => (
          <li key={item.name} className="upcoming-item">
            {item.url ? (
              <a className="upcoming-link" href={item.url} target="_blank" rel="noopener noreferrer">
                <span className="upcoming-name">{item.name}</span>
                <span className="upcoming-arrow" aria-hidden="true">↗</span>
              </a>
            ) : (
              <span className="upcoming-link">
                <span className="upcoming-name">{item.name}</span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
