import { useCallback, useEffect, useRef, useState } from 'react'
import { withBase } from '../lib/asset'
import { cropToWebP } from '../lib/image'
import { useCmdEnter } from '../lib/cmdEnter'
import { useI18n } from '../lib/i18n'

// The output aspect ratios the cycler (#8) offers, widest-relevant last. `null`
// = keep the source's own ratio (no crop — the whole-frame case). Ratio = w/h.
const ASPECTS: { key: string; ratio: number | null }[] = [
  { key: 'original', ratio: null },
  { key: '1:1', ratio: 1 },
  { key: '4:3', ratio: 4 / 3 },
  { key: '3:2', ratio: 3 / 2 },
  { key: '16:9', ratio: 16 / 9 },
  { key: '2:1', ratio: 2 }, // flatter than 16:9, per owner
]

const clamp = (v: number, lo: number, hi: number) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)))

// Frameless image viewer + frame editor (owner spec #4–#10): the popup is the
// image itself (no card chrome — #9); a floating control pill sits over it.
// Pan (drag), zoom (wheel + two-finger pinch), aspect cycle. The canvas shows
// exactly the crop that Save bakes (WYSIWYG). Save commits the reframed WebP via
// `onSave(dataUrl)`; delete confirms then `onDelete`; the backdrop closes (#6).
export default function ImageFrame({
  src,
  onSave,
  onDelete,
  onClose,
}: {
  src: string
  onSave: (dataUrl: string) => Promise<void>
  onDelete: () => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [nat, setNat] = useState({ w: 1, h: 1 })
  const [aspectIdx, setAspectIdx] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [center, setCenter] = useState({ x: 0.5, y: 0.5 }) // normalized source coords
  const [box, setBox] = useState({ w: 0, h: 0 }) // on-screen preview size (CSS px)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [caption, setCaption] = useState('')
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinchDist = useRef(0)

  // Esc closes the frame (matches the backdrop click).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Load the (same-origin) image so the canvas stays untainted and exportable.
  useEffect(() => {
    const im = new Image()
    im.onload = () => {
      setImg(im)
      setNat({ w: im.naturalWidth, h: im.naturalHeight })
      setAspectIdx(0)
      setZoom(1)
      setCenter({ x: 0.5, y: 0.5 })
      setDirty(false)
    }
    im.src = withBase(src) ?? src
  }, [src])

  const ratio = ASPECTS[aspectIdx].ratio
  const A = ratio ?? (nat.w / nat.h || 1)

  // Fit the preview box (aspect A) into the available viewport.
  useEffect(() => {
    const fit = () => {
      const availW = window.innerWidth * 0.92
      const availH = (window.visualViewport?.height ?? window.innerHeight) * 0.78
      let w = availW
      let h = w / A
      if (h > availH) {
        h = availH
        w = h * A
      }
      setBox({ w, h })
    }
    fit()
    window.addEventListener('resize', fit)
    window.visualViewport?.addEventListener('resize', fit)
    return () => {
      window.removeEventListener('resize', fit)
      window.visualViewport?.removeEventListener('resize', fit)
    }
  }, [A])

  // The source rectangle currently in view (source px), clamped inside the image.
  const srcRect = useCallback(() => {
    const vwBase = Math.min(nat.w, nat.h * A)
    const vhBase = vwBase / A
    const vw = vwBase / zoom
    const vh = vhBase / zoom
    const cx = clamp(center.x * nat.w, vw / 2, nat.w - vw / 2)
    const cy = clamp(center.y * nat.h, vh / 2, nat.h - vh / 2)
    return { x: cx - vw / 2, y: cy - vh / 2, w: vw, h: vh, vwBase }
  }, [nat, A, zoom, center])

  // Redraw the preview whenever the model or box changes (preview == the bake).
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !img || box.w === 0) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(box.w * dpr)
    canvas.height = Math.round(box.h * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const r = srcRect()
    ctx.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, canvas.width, canvas.height)
  }, [img, box, srcRect])

  // Non-passive wheel so preventDefault sticks (page must not scroll while zooming).
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setZoom((z) => clamp(z * (1 - e.deltaY * 0.0015), 1, 8))
      setDirty(true)
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [])

  // iOS Safari fires its own gesture* events on a two-finger pinch and zooms the
  // whole page even with touch-action:none — swallow them over the canvas so the
  // pinch drives our zoom, not Safari's page zoom.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const stop = (e: Event) => e.preventDefault()
    canvas.addEventListener('gesturestart', stop)
    canvas.addEventListener('gesturechange', stop)
    canvas.addEventListener('gestureend', stop)
    return () => {
      canvas.removeEventListener('gesturestart', stop)
      canvas.removeEventListener('gesturechange', stop)
      canvas.removeEventListener('gestureend', stop)
    }
  }, [])

  const panBy = (dx: number, dy: number) => {
    const r = srcRect()
    setCenter((c) => ({
      x: c.x - (dx * (r.w / box.w)) / nat.w,
      y: c.y - (dy * (r.h / box.h)) / nat.h,
    }))
    setDirty(true)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    ;(e.target as Element).setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinchDist.current = Math.hypot(a.x - b.x, a.y - b.y)
    }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      if (pinchDist.current > 0) {
        setZoom((z) => clamp(z * (d / pinchDist.current), 1, 8))
        setDirty(true)
      }
      pinchDist.current = d
    } else if (pointers.current.size === 1) {
      panBy(e.clientX - prev.x, e.clientY - prev.y)
    }
  }
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    pinchDist.current = 0
  }

  const cycleAspect = () => {
    setAspectIdx((i) => (i + 1) % ASPECTS.length)
    setDirty(true)
  }

  // ponytail: Save bakes the crop into the WebP file itself, so the framing is
  // honored wherever the file is embedded verbatim — i.e. prose/body images in
  // a post. Card & thumbnail slots still object-fit their own fixed box on top,
  // re-cropping. To honor this framing there too, later: store the chosen ratio
  // in frontmatter and drive each slot's aspect-ratio from it.
  const save = async () => {
    if (!img) return
    setSaving(true)
    try {
      const r = srcRect()
      const outW = Math.min(1400, r.vwBase / zoom)
      await onSave(cropToWebP(img, r, outW, outW / A))
    } finally {
      setSaving(false)
    }
  }

  const del = () => {
    if (window.confirm(t('imageFrame.deleteConfirm'))) onDelete()
  }

  useCmdEnter(save, dirty && !saving)

  // Copy a ready-to-paste markdown image tag with the caption from the inline
  // field, then close the frame — the editor pastes it onto the target line. The
  // caption renders as the faint centered subtitle under the image. The write is
  // synchronous inside the tap: window.prompt is a no-op in iOS standalone mode
  // and the blocking dialog also drops the transient activation clipboard needs.
  const copyMd = async () => {
    await navigator.clipboard.writeText(`![${caption.trim()}](${src})`)
    onClose()
  }

  const aspectLabel = ratio === null ? t('imageFrame.original') : ASPECTS[aspectIdx].key

  return (
    <div className="image-frame-backdrop" onClick={onClose}>
      <div className="image-frame" onClick={(e) => e.stopPropagation()}>
        <canvas
          ref={canvasRef}
          className="image-frame-canvas"
          style={{ width: box.w, height: box.h, touchAction: 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        <div className="image-frame-controls" onPointerDown={(e) => e.stopPropagation()}>
          <button type="button" className="btn btn-ghost image-frame-aspect" onClick={cycleAspect} disabled={saving}>
            <span className="image-frame-aspect-label">{t('imageFrame.aspect')}</span>
            {aspectLabel}
          </button>
          <input
            type="text"
            className="image-frame-caption"
            placeholder={t('imageFrame.captionPrompt')}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            disabled={saving}
          />
          <button type="button" className="btn btn-ghost" onClick={copyMd} disabled={saving}>
            {t('imageFrame.copyMd')}
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={!dirty || saving}>
            {saving ? t('editor.imageUploading') : t('imageFrame.save')}
          </button>
          <button type="button" className="btn btn-ghost image-frame-del" onClick={del} disabled={saving}>
            🗑
          </button>
        </div>
      </div>
    </div>
  )
}
