// Downscale a picked image file to a WebP `data:` URI, entirely in the browser
// — no upload endpoint needed for the encode step. Capped at `max` px on the
// long edge. Two callers: avatars (small, stored verbatim as the data: URI) and
// post covers (larger, base64 split off and committed as a real file — see
// contentEditor's image upload).
export function downscaleToWebP(file: File, max: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('no 2d context'))
      ctx.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(img.src)
      resolve(canvas.toDataURL('image/webp', 0.85))
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}
