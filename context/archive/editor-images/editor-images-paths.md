# Editor images: cover + gallery + frame editor — options

Redesign the content editor's image handling from the single "cover" control
into: a thumbnail **row** (first slot = the cover, labelled «Обложка»; a `＋`
adds more), where tapping any thumbnail opens a **frameless popup** to view /
reframe / delete that image. Source: the owner's annotated editor screenshot
(10 numbered behaviours) + the three scoping answers below.

## Decided (owner, this session)

1. **Frame editor that SAVES** — pinch-zoom (#10) + aspect cycle (#8) actually
   reframe the image, and Save (#7) **bakes the framing into the committed
   WebP** so it shows on the real site. Not a view-only lightbox.
2. **Cover + gallery** — multiple images per post, not just the cover. Needs a
   new frontmatter field AND a reader-facing render (readers see nothing until
   that render ships).
3. **Plan doc first** (this file) → owner approves a path → action plan →
   build.

## Verified current state (read, not assumed)

- **Content model** ([types.ts](../../src/lib/types.ts)): every content type has
  a single `image?: string` (a `/images/<name>` path). No gallery field exists.
- **Cover render**, one `<img>` each, always `object-fit: cover`:
  [ProductCard](../../src/components/ProductCard.tsx):12,
  [ReviewDetail](../../src/pages/ReviewDetail.tsx):79 (`.detail-image`),
  [EntryDetail](../../src/pages/EntryDetail.tsx):88 (`.detail-image`). Detail
  images are capped 440px tall / centered on desktop only (styles.css).
- **Inline body images** are markdown `![](path)` → `marked` → `.prose img`.
- **Image pipeline**: [image.ts](../../src/lib/image.ts) `downscaleToWebP(file,
  max)` draws the *whole* image to a canvas at a long-edge cap and returns a
  WebP data URI (q 0.85). No crop — it's the whole frame. The editor's
  `uploadFile` ([contentEditor.tsx](../../src/lib/contentEditor.tsx):380)
  downscales to 1400px, splits the base64, and `uploadImage` →
  `POST /content/image` commits one WebP to `public/images/*.webp` (its own
  commit, ValidImagePath allowlist, ≤1 MB decoded). Returns `/images/<name>`.
- **Picker** ([ImagePicker.tsx](../../src/components/ImagePicker.tsx)): a modal
  **grid** of every bundled image + a "From your device" upload button;
  `onPick(path)` / `onClose` / optional `onUpload`. Presentational — the caller
  owns what the path fills.
- **Cover control today** ([contentEditor.tsx](../../src/lib/contentEditor.tsx):848):
  a thumb + a "Set image" button that opens the picker aimed at `cover`;
  `applyImage` writes `image:` via `applyScalarEdit`. The 🖼 toolbar button aims
  the same picker at `inline` (splices `![](path)` at the caret).
- **Frontmatter arrays already work**: `setField`
  ([frontmatter.ts](../../src/lib/frontmatter.ts):73) emits a flow seq for array
  values, and `tags` are edited as a list today
  ([FrontmatterFields.tsx](../../src/components/FrontmatterFields.tsx)). **So a
  `gallery:` list needs no new YAML machinery.**
- **RU→EN cover mirror** ([contentEditor.tsx](../../src/lib/contentEditor.tsx):553,
  `enCoverMirror`): saving an RU post copies its `image:` onto the EN sibling in
  the same commit (shared media, RU is source). Inline body images stay
  per-locale.

## Open axis 1 — how the gallery is stored

- **A. `image:` (cover) + `gallery: [paths…]`** *(recommended)* — the cover
  stays exactly as-is (nothing about cover render/mirror/cards changes);
  `gallery` is purely additive. First row slot binds `image:`, the rest bind
  `gallery`. Least blast radius; `image:`-only posts are unchanged.
- **B. One `images: [paths…]`, `[0]` = cover** — cleaner conceptually (one
  list, first is special) but rewrites every existing post's `image:` →
  `images:`, touches all cover readers + the RU→EN mirror + cards. Big migration
  for a cosmetic gain.
- **C. Objects with per-image metadata** (`gallery: [{src, alt, aspect}]`) —
  needed only if aspect/alt must persist as *data* rather than being baked into
  the file. Adds nested-YAML editing we don't have. See axis 3 — if framing is
  baked into the pixels, we don't need this.

## Open axis 2 — reader-facing gallery render (the new, public part)

Where the extra images actually appear (review + journal detail pages):

- **A. A simple thumbnail strip under the hero that opens a lightbox**
  *(recommended)* — a row of `object-fit:cover` thumbs below `.detail-image`;
  tap → the same frameless viewer (reused read-only). Matches the round,
  calm aesthetic; low code; degrades to nothing when `gallery` is empty.
- **B. A carousel / swipe deck** — more "app-y", more JS, more that can feel
  busy against the site's stillness. Reserve unless the owner wants it.
- **C. Inline in the body only (no dedicated block)** — cheapest, but then
  "gallery" is just the existing inline-image feature with a nicer picker, which
  contradicts the cover+gallery decision.

> This is the one **reader-facing** piece and the site's identity guards it
> (stillness over app-busyness). Worth a short **gaia-mentor** pass before
> locking the treatment — flag for the owner.

## Open axis 3 — the frame editor (crop mechanics)

- **Bake vs metadata**: owner chose *bake*. So the popup runs a canvas crop —
  source-rect (from pan+zoom) + chosen output aspect → WebP → commit (reusing
  `POST /content/image`). Extend `downscaleToWebP` into a
  `cropToWebP(file|img, srcRect, outW, outH)` (or a small sibling) — the crop
  superset, existing whole-frame call stays a special case.
- **Aspect set** to cycle (#8): propose a small fixed list — `original`, `4:3`,
  `1:1`, `3:2`, `16:9`. Open to the owner's preferred ratios.
- **Consequence to surface**: once framing is baked, the stored file already
  *is* the crop, but the render slots still use `object-fit:cover` at
  slot-driven heights — so a baked 1:1 can still be re-cropped by a 16:9 card.
  Baking controls *content* framing (what's in view), not the slot's shape.
  That's fine for "frame the subject" but isn't pixel-exact per surface. Decide
  if that's acceptable (recommended: yes) or if render slots should honour the
  baked aspect (more CSS work).
- **Zoom input**: pinch on touch; on desktop, scroll-to-zoom + drag-pan (pinch
  is touch-only). Both drive the same source-rect.

## Open axis 4 — reuse boundaries (ponytail)

- **Picker**: keep `ImagePicker` as the *chooser* (library grid + OS upload);
  add the row + the frameless **viewer/frame-editor** as a new component
  (`ImageFrame`?) rather than overloading the picker. The row's `＋` opens the
  existing picker; picking/uploading appends to `gallery` (or sets `image:` for
  the empty cover slot).
- **Encode**: one crop-capable canvas helper, not a new dependency. No new npm.
- **Commit**: reuse `POST /content/image` untouched. Gallery paths are plain
  `/images/*.webp` like covers.

## Cross-cutting decisions

- **RU→EN mirror**: extend `enCoverMirror` to also mirror `gallery` (shared
  media, same rationale as the cover), or leave gallery per-locale? *Recommend
  mirror the whole gallery* — same "media is shared, prose is translated" line.
- **Delete-with-confirm** (#5): removes the path from `image:`/`gallery` (a
  `window.confirm`, like `attemptClose`). It does **not** delete the committed
  file (other posts may reuse it; orphan cleanup is out of scope).
- **Tap-outside (#6) / Save (#7)**: backdrop click closes the viewer; Save only
  appears when a reframe is pending (idle viewer = view-only).
- **«Обложка» label (#3)**: rendered as an overlay on the first row slot only;
  it's the cover, bound to `image:`.
- **Provenance**: none — this is media handling, not authored prose. No
  Compass/translation contract implications.
- **Stale comment to fix in passing**: `.login-overlay` CSS still says
  `useVisibleViewportVars` "scroll-locks the body" — untrue since this session
  dropped the lock. Fix when we touch viewport CSS.

## Recommended path (one line)

Axis 1 **A** (`image:` + `gallery:`), axis 2 **A** (thumb strip → reused
frameless viewer), axis 3 **bake via a crop-capable canvas helper** with a fixed
aspect list, axis 4 **new `ImageFrame` viewer + reuse `ImagePicker` & the image
commit**. Mirror `gallery` RU→EN. One reader-facing piece (the strip) — run it
past gaia-mentor before locking.

## Open questions for the owner

1. Gallery storage: confirm **A** (`image:` + `gallery:`) over the one-list
   migration?
2. Reader render: confirm the **thumb-strip-under-hero** treatment (and want a
   gaia-mentor pass on it first)?
3. Aspect ratios to offer in the cycler — the proposed set, or your own?
4. Baked-framing-vs-slot-shape tradeoff (axis 3): accept "frame the subject, the
   slot still cover-fits", or do you want render slots to honour the baked
   aspect?
