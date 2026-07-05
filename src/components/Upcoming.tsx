import type { UpcomingItem } from "../lib/types";
import CopyButton from "./CopyButton";

/**
 * The "in the works" rail shared by /reviews and /journal: a flat list of
 * rectangles, one per queued-but-not-written item. Title/note come from the
 * caller (each page has its own strings). An item with a `url` links out
 * (reviews → the product's Amazon listing); without one it's a plain row
 * (journal entry ideas have nowhere to link yet). Deliberately NOT presented
 * as real content: no rating, no date, no verdict.
 *
 * `contribute` renders the "Contribute!" copy-a-template button right under
 * the title — the rail is the natural home for "help write what's coming".
 */
export default function Upcoming({ title, note, items, contribute }: { title: string; note: string; items: UpcomingItem[]; contribute?: { value: string; label: string } }) {
  if (items.length === 0 && !contribute) return null;

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
                <span className="upcoming-arrow" aria-hidden="true">
                  ↗
                </span>
              </a>
            ) : (
              <span className="upcoming-link">
                <span className="upcoming-name">{item.name}</span>
              </span>
            )}
          </li>
        ))}
      </ul>
      {contribute && <CopyButton value={contribute.value} label={contribute.label} className="copy-template-btn" />}
    </section>
  );
}
