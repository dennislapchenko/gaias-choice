import { useEffect } from 'react'

/**
 * Make a full-height modal overlay behave under the mobile on-screen keyboard.
 * While `open`, this does two things:
 *
 *  1. **Locks background scroll** by pinning `<body>` (position:fixed at the
 *     current scrollY, restored on close). Without this, iOS Safari scrolls the
 *     LAYOUT viewport to reveal a focused input and drags every `position:fixed`
 *     element off-screen with it — the overlay's header ends up above the top
 *     edge. Pinning the body stops that scroll, so the fixed overlay stays put
 *     and can simply sit at `top:0`.
 *  2. **Mirrors the visible height** onto the global `--vv-h` CSS var from
 *     `window.visualViewport` (the only signal that shrinks when the keyboard
 *     opens — iOS keeps `vh`/`dvh` at full screen height under it), so the
 *     overlay fills exactly the space above the keyboard. No visualViewport
 *     (older desktop) ⇒ the var stays unset and CSS falls back to `100vh`.
 *
 * ponytail: no refcount for stacked modals — the only overlays that use this
 * (editor, login) never open at once, so a single writer is always fine.
 */
export function useVisibleViewportVars(open: boolean): void {
  useEffect(() => {
    if (!open) return
    const body = document.body
    const rootStyle = document.documentElement.style

    // Scroll lock (see #1). Restored exactly on cleanup.
    const scrollY = window.scrollY
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'

    const vv = window.visualViewport
    const apply = () => {
      if (vv) rootStyle.setProperty('--vv-h', `${vv.height}px`)
    }
    apply()
    vv?.addEventListener('resize', apply)
    vv?.addEventListener('scroll', apply)

    return () => {
      vv?.removeEventListener('resize', apply)
      vv?.removeEventListener('scroll', apply)
      rootStyle.removeProperty('--vv-h')
      body.style.position = ''
      body.style.top = ''
      body.style.left = ''
      body.style.right = ''
      body.style.width = ''
      window.scrollTo(0, scrollY)
    }
  }, [open])
}
