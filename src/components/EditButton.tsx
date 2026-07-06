// Reusable "edit" icon button (same stroke style as CopyButton). Icon-only;
// the caller decides visibility (edit-mode-only everywhere) and supplies the
// click handler — usually a `useContentEditor()` open call. `icon="pencil"`
// is the in-place edit affordance, `icon="plus"` the start-a-draft one.
export default function EditButton({
  onClick,
  className,
  ariaLabel,
  icon = 'pencil',
}: {
  onClick: () => void
  className?: string
  ariaLabel: string
  icon?: 'pencil' | 'plus'
}) {
  return (
    <button
      type="button"
      className={`edit-btn${className ? ` ${className}` : ''}`}
      onClick={onClick}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {icon === 'pencil' ? (
          <>
            <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
            <path d="M13 6.5l4.5 4.5" />
          </>
        ) : (
          <>
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </>
        )}
      </svg>
    </button>
  )
}
