import { Link } from 'react-router-dom'
import type { JournalEntry } from '../lib/types'

// A text-only entry row for the /journal list (no thumbnail — deliberately
// plainer than the Compass rows). The whole row is the <Link> (the outer
// element is the link, same pattern as CompassRow / .side-about).
export default function JournalRow({ entry }: { entry: JournalEntry }) {
  return (
    <Link to={`/journal/${entry.slug}`} className="journal-row">
      <span className="journal-row-date muted">{entry.date}</span>
      <h3 className="journal-row-title">{entry.title}</h3>
      <p className="journal-row-excerpt">{entry.excerpt}</p>
    </Link>
  )
}
