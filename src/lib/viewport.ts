import { useEffect } from 'react'

/**
 * Make a full-screen modal overlay track the mobile on-screen keyboard. While
 * `open`, it mirrors `window.visualViewport` onto two global CSS vars the
 * overlays position against (`.content-editor-overlay`, `.login-overlay`):
 *
 *  - **`--vv-h`** = `visualViewport.height`. iOS keeps `vh`/`dvh` at full screen
 *    height under the keyboard; the visual viewport is the only signal that
 *    shrinks. The overlay uses it as its height so it fills exactly the space
 *    above the keyboard, Save button included.
 *  - **`--vv-top`** = `visualViewport.offsetTop`. To reveal a focused input, iOS
 *    pans the VISUAL viewport downward (measured: offsetTop jumps to ~242px),
 *    which drags every `position:fixed` layer up off the top edge — a body
 *    scroll-lock does NOT prevent this pan. So the overlay pins its `top` to
 *    offsetTop and stays glued to the visible rect instead of scrolling away.
 *
 * No visualViewport (older desktop) ⇒ both vars stay unset and CSS falls back
 * to `top:0; height:100vh`.
 *
 * ponytail: no refcount for stacked modals — the only overlays that use this
 * (editor, login) never open at once, so a single writer is always fine.
 */
export function useVisibleViewportVars(open: boolean): void {
  useEffect(() => {
    if (!open) return
    const rootStyle = document.documentElement.style
    const vv = window.visualViewport
    const apply = () => {
      if (!vv) return
      // iOS's form-assistant accessory bar (~44pt: the Done + prev/next strip)
      // sits above the keyboard but is NOT excluded from visualViewport.height,
      // so a modal sized to the full height hides its bottom row (Save) behind
      // it. Reserve it while the keyboard is up (height shrunk well below
      // innerHeight). ponytail: 48 is the standard bar height; bump if a future
      // iOS grows it.
      // ...but only when there's height to spare. On a landscape phone the
      // strip above the keyboard is already ~130px; spending 48 of it makes the
      // modal (which scrolls in that case — see the max-height:430px CSS) worse,
      // not better, so skip the reserve when the visible viewport is that short.
      const keyboardUp = window.innerHeight - vv.height > 120
      const reserve = keyboardUp && vv.height > 200 ? 48 : 0
      rootStyle.setProperty('--vv-h', `${vv.height - reserve}px`)
      rootStyle.setProperty('--vv-top', `${vv.offsetTop}px`)
    }
    apply()
    vv?.addEventListener('resize', apply)
    vv?.addEventListener('scroll', apply)

    return () => {
      vv?.removeEventListener('resize', apply)
      vv?.removeEventListener('scroll', apply)
      rootStyle.removeProperty('--vv-h')
      rootStyle.removeProperty('--vv-top')
    }
  }, [open])
}
