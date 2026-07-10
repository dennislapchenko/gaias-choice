import { useEffect, useState } from 'react'

/**
 * True below a CSS breakpoint (default the 900px point where the two-column
 * layouts collapse). Starts `false` (the desktop / prerendered shape) and syncs
 * after mount, so hydration sees identical trees; the visual collapse itself
 * stays CSS-driven. Shared by the sidebar and the account rail.
 */
export function useIsNarrow(query = '(max-width: 900px)'): boolean {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(query)
    setNarrow(mq.matches)
    const onChange = () => setNarrow(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return narrow
}

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
    const body = document.body
    const rootStyle = document.documentElement.style

    // Scroll-lock the page behind the overlay: without it a vertical swipe on any
    // non-scrollable part of the modal (e.g. the image strip) scroll-chains to
    // the page underneath. position:fixed (not overflow:hidden) is what iOS
    // actually respects; scrollY is captured and restored exactly on cleanup.
    // Orthogonal to --vv-top below (that handles the iOS keyboard VISUAL-viewport
    // pan, which a body lock does NOT prevent).
    const scrollY = window.scrollY
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'

    const vv = window.visualViewport
    const apply = () => {
      if (!vv) return
      // visualViewport.height on iOS already excludes the keyboard AND its
      // form-assistant accessory bar (the Done + prev/next strip), so the modal
      // sized to it lands flush above that bar — no reserve needed. (An earlier
      // 48px reserve double-counted the bar and left a dead band below Save.)
      rootStyle.setProperty('--vv-h', `${vv.height}px`)
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
      body.style.position = ''
      body.style.top = ''
      body.style.left = ''
      body.style.right = ''
      body.style.width = ''
      window.scrollTo(0, scrollY)
    }
  }, [open])
}
