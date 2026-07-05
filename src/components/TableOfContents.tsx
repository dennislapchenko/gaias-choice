import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../lib/i18n'

// True below the point where the detail layout collapses to a single column
// (kept in sync with the `max-width: 900px` rule in styles.css, same
// breakpoint the site-wide sidebar uses — see components/Sidebar.tsx).
function useIsNarrow() {
  const query = '(max-width: 900px)'
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setNarrow(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return narrow
}

interface TocItem {
  id: string
  text: string
  depth: 2 | 3
}

/** Parses h2/h3 (with ids stamped by the `marked` renderer in lib/content.ts) out of
 * already-rendered guide HTML. No runtime markdown re-parse — just a DOM read. */
function extractHeadings(html: string): TocItem[] {
  if (typeof DOMParser === 'undefined') return []
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const items: TocItem[] = []
  doc.querySelectorAll('h2[id], h3[id]').forEach((el) => {
    items.push({
      id: el.id,
      text: el.textContent ?? '',
      depth: el.tagName === 'H2' ? 2 : 3,
    })
  })
  return items
}

// A page-local "you are here" nav built from the article's own h2/h3 headings.
// Distinct from the site-wide left rail (components/Sidebar.tsx) — this one
// lives inside the article layout (see `.detail-layout` in styles.css) and
// only concerns itself with the current page's headings. Renders nothing for
// short guides (fewer than 3 headings).
export default function TableOfContents({ html }: { html: string }) {
  const { t } = useI18n()
  const items = useMemo(() => extractHeadings(html), [html])
  const [activeId, setActiveId] = useState<string | null>(null)
  const narrow = useIsNarrow()

  useEffect(() => {
    if (items.length < 3) return
    const headingEls = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null)
    if (headingEls.length === 0) return

    // "Active" = the last heading (in document order) that has scrolled past
    // the read line just under the sticky header — far more forgiving than
    // requiring a heading to sit inside a thin viewport band, since headings
    // can be hundreds/thousands of px apart in a long guide. IntersectionObserver
    // (rather than a scroll listener) is used purely as the cheap "recompute
    // now" trigger; threshold 0 with a rootMargin pulled up past the header
    // fires whenever any heading crosses that line.
    const READ_LINE = 96
    const recompute = () => {
      let current = headingEls[0]
      for (const el of headingEls) {
        if (el.getBoundingClientRect().top <= READ_LINE) current = el
      }
      setActiveId(current.id)
    }
    const observer = new IntersectionObserver(recompute, {
      rootMargin: `-${READ_LINE}px 0px 0px 0px`,
      threshold: 0,
    })
    headingEls.forEach((el) => observer.observe(el))
    recompute()
    return () => observer.disconnect()
  }, [items])

  if (items.length < 3) return null

  return (
    <details className="toc" open={!narrow}>
      <summary className="toc-toggle">{t('toc.toggle')}</summary>
      <nav className="toc-nav" aria-label={t('toc.ariaLabel')}>
        <ul className="toc-list">
          {items.map((item) => (
            <li key={item.id} className={`toc-item toc-item-h${item.depth}`}>
              <a href={`#${item.id}`} className={activeId === item.id ? 'is-active' : undefined}>
                {item.text}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </details>
  )
}
