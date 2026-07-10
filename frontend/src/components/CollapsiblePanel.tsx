import { useEffect, useState, type ReactNode } from 'react'

// The site's one foldable/headered section: a flat rectangular header
// (`.side-panel-toggle` + chevron) over collapsible content. Born in the left
// sidebar; reused anywhere we need a headered fold (account stats tables, the
// your-details panel) so every such section reads the same. House rule: new
// foldable/headered sections use THIS, not a bespoke header — see CLAUDE.md
// "Styling & color".
//
// `forceClosed` lets a panel be collapsed while a page that already covers its
// content is open (About's panel vs. `/about` or `/account`) — it reopens to
// its normal state once the reader navigates away. Panels that don't pass it
// behave exactly as before.
export default function CollapsiblePanel({
  label,
  defaultOpen,
  forceClosed,
  children,
}: {
  label: string
  defaultOpen: boolean
  forceClosed?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen && !forceClosed)
  useEffect(() => {
    if (forceClosed === undefined) return
    setOpen(!forceClosed && defaultOpen)
  }, [forceClosed]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section className={`side-panel${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="side-panel-toggle"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{label}</span>
        <span className="side-chevron" aria-hidden="true" />
      </button>
      {open && <div className="side-panel-body">{children}</div>}
    </section>
  )
}
