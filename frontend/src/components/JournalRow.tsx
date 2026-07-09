import { Link } from 'react-router-dom'
import type { JournalEntry } from '../lib/types'
import { withBase } from '../lib/asset'

// An entry row for the /journal list: a thumbnail taking the left quarter, then
// the text. The whole row is the <Link> (same pattern as CompassRow /
// .side-about). Falls back to a leaf placeholder when the entry has no image
// (same glyph as ProductCard's empty media).
export default function JournalRow({ entry }: { entry: JournalEntry }) {
  return (
    <Link to={`/journal/${entry.slug}`} className="journal-row">
      <div className="journal-row-media">
        {entry.image ? (
          <img src={withBase(entry.image)} alt={entry.title} loading="lazy" />
        ) : (
          <div className="placeholder" aria-hidden="true">
            🌿
          </div>
        )}
      </div>
      <div className="journal-row-text">
        <span className="journal-row-date muted">{entry.date}</span>
        <h3 className="journal-row-title">{entry.title}</h3>
        <p className="journal-row-excerpt">{entry.excerpt}</p>
      </div>
    </Link>
  )
}
