import { useEffect } from 'react'

/**
 * While `open`, mirror the on-screen-keyboard-aware *visible* viewport onto the
 * global `--vv-h`/`--vv-t` CSS vars, so a modal overlay pinned to them shrinks
 * to the space above the keyboard instead of hiding behind it. iOS Safari keeps
 * `vh`/`dvh` at full screen height under the keyboard — `window.visualViewport`
 * is the only signal that moves. No visualViewport (older desktop) ⇒ the vars
 * stay unset and CSS falls back to `100vh`/`top:0`.
 *
 * ponytail: no refcount for stacked modals — the only overlays that use this
 * (editor, login) never open at once, so a single writer is always fine.
 */
export function useVisibleViewportVars(open: boolean): void {
  useEffect(() => {
    const vv = window.visualViewport
    if (!open || !vv) return
    const apply = () => {
      const s = document.documentElement.style
      s.setProperty('--vv-h', `${vv.height}px`)
      s.setProperty('--vv-t', `${vv.offsetTop}px`)
    }
    apply()
    vv.addEventListener('resize', apply)
    vv.addEventListener('scroll', apply)
    return () => {
      vv.removeEventListener('resize', apply)
      vv.removeEventListener('scroll', apply)
      document.documentElement.style.removeProperty('--vv-h')
      document.documentElement.style.removeProperty('--vv-t')
    }
  }, [open])
}
