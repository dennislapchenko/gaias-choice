// Browser-native text-to-speech (Web Speech API). No deps, no network, no cost —
// voice quality is whatever the visitor's OS ships. speechSynthesis has its own
// queue, so we enqueue every chunk and it plays them back-to-back.

export const speechSupported =
  typeof window !== 'undefined' && 'speechSynthesis' in window

// A sentence-sized utterance, tagged with the section it belongs to so the
// caller can advance a highlight as reading moves through the page.
export interface SpeakChunk {
  text: string
  section: number
}

// Split section text into sentence-sized chunks. Chrome silently truncates a
// single utterance after ~15s/~200 chars; short chunks sidestep that and give
// finer stop granularity. Same sentence punctuation works for RU.
// ponytail: naive punctuation split — good enough; swap for Intl.Segmenter if a
// locale needs smarter sentence boundaries.
export function toChunks(text: string, section: number): SpeakChunk[] {
  const parts = text.match(/[^.!?…]+[.!?…]*/g) ?? [text]
  return parts
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => ({ text: s, section }))
}

export function stopSpeaking(): void {
  if (speechSupported) window.speechSynthesis.cancel()
}

// Enqueue every chunk. `onSection(i)` fires when a chunk from section i starts
// speaking (advance the highlight); `onDone` fires after the last chunk ends.
export function speakChunks(
  chunks: SpeakChunk[],
  lang: string,
  onSection: (section: number) => void,
  onDone: () => void,
): void {
  const synth = window.speechSynthesis
  synth.cancel()
  if (chunks.length === 0) return
  chunks.forEach((chunk, i) => {
    const u = new SpeechSynthesisUtterance(chunk.text)
    u.lang = lang
    u.onstart = () => onSection(chunk.section)
    if (i === chunks.length - 1) u.onend = onDone
    synth.speak(u)
  })
}
