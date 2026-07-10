import { useEffect, useRef } from 'react'
import { speechSupported, toChunks, speakChunks, stopSpeaking } from '../lib/speak'

export interface TtsOpts {
  locale: string
  playLabel: string
  stopLabel: string
}

/** Renders pre-built (trusted, author-controlled) HTML from our markdown files.
 * With `tts`, injects a 🔊 button into each h2 that reads that section aloud and
 * the rest of the page after it, using the browser-native Web Speech API. */
export default function Markdown({ html, tts }: { html: string; tts?: TtsOpts }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!tts || !speechSupported) return
    const root = ref.current
    if (!root) return
    const heads = Array.from(root.querySelectorAll('h2')) as HTMLElement[]
    if (heads.length === 0) return

    const lang = tts.locale === 'ru' ? 'ru-RU' : 'en-US'
    // Section text = the heading plus every sibling up to the next h2.
    const sectionText = (h: HTMLElement) => {
      let text = h.textContent ?? ''
      for (let el = h.nextElementSibling; el && el.tagName !== 'H2'; el = el.nextElementSibling) {
        text += '. ' + (el.textContent ?? '')
      }
      return text
    }
    // Clicking a button reads that section and every one after it — the queue
    // continues automatically once the clicked section finishes.
    const chunksFrom = (i: number) =>
      heads.slice(i).flatMap((h, j) => toChunks(sectionText(h), i + j))

    const buttons = heads.map((h) => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'speak-btn'
      btn.setAttribute('aria-label', tts.playLabel)
      btn.textContent = '🔊'
      h.appendChild(btn)
      return btn
    })

    let activeSection = -1 // section currently being read, or -1 when idle
    let runId = 0 // guards against stale callbacks from a cancelled run
    const setActive = (section: number) => {
      activeSection = section
      buttons.forEach((b, i) => {
        const on = i === section
        b.classList.toggle('is-speaking', on)
        b.setAttribute('aria-label', on ? tts.stopLabel : tts.playLabel)
      })
    }
    const reset = () => {
      activeSection = -1
      buttons.forEach((b) => {
        b.classList.remove('is-speaking')
        b.setAttribute('aria-label', tts.playLabel)
      })
    }
    buttons.forEach((btn, i) => {
      btn.addEventListener('click', () => {
        if (i === activeSection) {
          runId++
          stopSpeaking()
          reset()
          return
        }
        const id = ++runId
        speakChunks(
          chunksFrom(i),
          lang,
          (s) => id === runId && setActive(s),
          () => id === runId && reset(),
        )
      })
    })

    return () => {
      runId++
      stopSpeaking()
      buttons.forEach((b) => b.remove())
    }
    // Primitive deps (not the `tts` object) so an inline literal from a
    // re-rendering parent doesn't tear down and cancel active playback.
  }, [html, tts?.locale, tts?.playLabel, tts?.stopLabel])

  return <div className="prose" ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
}
