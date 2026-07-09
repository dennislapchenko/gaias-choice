import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../lib/i18n'

// Copy `text`, returning whether it worked. Tries the async Clipboard API first,
// then falls back to a hidden-textarea `execCommand` — which also covers the
// cases where the async API exists but is rejected (permission denied, sandboxed
// iframe, insecure context).
async function writeToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to the execCommand path
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

// Reusable copy-to-clipboard button. Hand it the text to copy; it shows a brief
// check state and localized "Copied" label. Reveal-on-hover is opt-in via the
// container's CSS (see `.copy-btn` + the `.crypto-copy` reveal rule in
// styles.css) so it works standalone too. Meant for any copyable field — wallet
// addresses today, more (emails, referral links, API-ish values) later.
//
// Icon-only by default (the wallet use). Pass `label` for a labelled action
// button (the Journal "copy template" button): the text renders beside the icon
// and swaps to the localized "Copied" on success.
export default function CopyButton({
  value,
  className,
  ariaLabel,
  label,
}: {
  value: string
  className?: string
  ariaLabel?: string // overrides the default "Copy" label (e.g. "Copy BTC address")
  label?: string // visible button text; when set, renders a labelled button
}) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const copy = async () => {
    if (!(await writeToClipboard(value))) return // blocked everywhere — value stays visible to select
    setCopied(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(false), 1600)
  }

  const copiedText = t('copy.copied')
  const aria = copied ? copiedText : ariaLabel ?? label ?? t('copy.copy')

  return (
    <button
      type="button"
      className={`copy-btn${copied ? ' is-copied' : ''}${className ? ` ${className}` : ''}`}
      onClick={copy}
      aria-label={aria}
      title={aria}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {copied ? (
          <path d="M5 12.5l4 4L19 7" />
        ) : (
          <>
            <rect x="9" y="9" width="11" height="12" rx="2" />
            <path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5" />
          </>
        )}
      </svg>
      {label != null && <span className="copy-btn-label">{copied ? copiedText : label}</span>}
    </button>
  )
}
