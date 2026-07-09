// Encode a canvas to a compact lossy `data:` URI. Prefer WebP, fall back to
// JPEG: mobile WebKit (older iOS, in-app WebViews) can't encode WebP from a
// canvas and silently returns a *large lossless PNG* for
// toDataURL('image/webp') — which blows the upload/avatar size caps, so uploads
// just failed on phones. JPEG canvas-encode is universal and comparably small
// for photos. The mime stays in the returned data URI so callers pick the right
// file extension.
function encodeLossy(canvas: HTMLCanvasElement): string {
  const webp = canvas.toDataURL('image/webp', 0.85)
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.85)
}

// Downscale a picked image file to a lossy `data:` URI (WebP, or JPEG where WebP
// encode is unsupported — see encodeLossy), entirely in the browser — no upload
// endpoint needed for the encode step. Capped at `max` px on the long edge. Two
// callers: avatars (small, stored verbatim as the data: URI) and post covers
// (larger, base64 split off and committed as a real file — see contentEditor's
// image upload).
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
      resolve(encodeLossy(canvas))
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

// Bake a crop into a WebP data URI: draw a source rectangle of `img` into an
// `outW × outH` canvas (the chosen aspect + zoom/pan the frame editor computed)
// and encode. `downscaleToWebP` is the whole-frame special case of this; this is
// the crop superset used when Save-ing a reframed cover/gallery image
// (ImageFrame → contentEditor commits the result as a fresh /images/*.webp).
export function cropToWebP(
  img: CanvasImageSource,
  src: { x: number; y: number; w: number; h: number },
  outW: number,
  outH: number,
): string {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(outW))
  canvas.height = Math.max(1, Math.round(outH))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no 2d context')
  ctx.drawImage(img, src.x, src.y, src.w, src.h, 0, 0, canvas.width, canvas.height)
  return encodeLossy(canvas)
}
