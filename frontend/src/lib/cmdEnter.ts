import { useEffect } from 'react'

/**
 * Site-wide Cmd/Ctrl+Enter → the current context's primary action (save a post,
 * save a photo, confirm a yes/no). A LIFO stack so the topmost open surface wins
 * — e.g. the image frame over the editor sitting behind it — and one keydown
 * listener for the whole app.
 */
const stack: Array<() => void> = []
let installed = false

function onKey(e: KeyboardEvent) {
  if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey)) return
  const top = stack[stack.length - 1]
  if (!top) return
  e.preventDefault()
  top()
}

export function useCmdEnter(action: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    if (!installed) {
      window.addEventListener('keydown', onKey)
      installed = true
    }
    stack.push(action)
    return () => {
      const i = stack.lastIndexOf(action)
      if (i >= 0) stack.splice(i, 1)
    }
  }, [action, enabled])
}
