// The live-edit popup (git-backed, live-edit-paths.md Path A). Two dialog
// flows plus one dialog-less action, all edit-mode-only (useEditMode) and
// all ending in a git commit through the backend's /api/content/* seam:
//
//  - FILE: edit a content file's whole raw text (frontmatter + body) in a
//    textarea. Fetches the CURRENT file (never the stale built-in copy); Save
//    writes back whatever text the admin left, with its sha. A sha conflict
//    (409) re-fetches and retries the same save once before surfacing.
//  - CREATE: the draft composer. Pre-filled template text saved as a NEW
//    content file (create = save without sha); refuses to overwrite.
//  - setPostState: no dialog — flips a post's `state` and, for RU
//    reviews/journal, propagates to the EN sibling (→ active (re)translates
//    RU→EN, → upcoming just mirrors the state; RU is the source of truth). The
//    underlying scalar flip is CST-level byte-preserving surgery — on the whole
//    file for plain YAML (site.yaml, themes.yaml), or just the `---` frontmatter
//    block for markdown content files, body spliced back untouched (see
//    FRONTMATTER_RE/applyScalarEdit). If the key is entirely absent (e.g. an
//    active post has no `state:` line), it's inserted rather than requiring
//    the key to preexist.
//
// Mounted once at the app root (see App.tsx), above <Routes> — never
// unmounted by client-side navigation, so an open draft survives following
// a link and coming back.
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { marked } from 'marked'
import { Composer, CST, isScalar, Parser, parseDocument } from 'yaml'
import CopyButton from '../components/CopyButton'
import ImagePicker from '../components/ImagePicker'
import ImageFrame from '../components/ImageFrame'
import FrontmatterFields from '../components/FrontmatterFields'
import { withBase } from './asset'
import { getSite } from './content'
import { useCmdEnter } from './cmdEnter'
import { DEBUG } from './debug'
import { dedupeFrontmatter, FRONTMATTER_RE, removeField, setField, type FrontmatterField } from './frontmatter'
import {
  apiDelete,
  apiGet,
  apiPost,
  ApiError,
  commitFiles,
  enrichTemplate,
  translateContent,
  uploadImage,
  type ContentFile,
  type DeleteResponse,
  type SaveResponse,
} from './api'
import { useEditMode } from './editMode'
import { useI18n } from './i18n'
import { downscaleToWebP } from './image'
import { useVisibleViewportVars } from './viewport'
import type { EditRef, PostState } from './types'

type EditorMode =
  | { kind: 'file'; path: string; sha: string }
  | { kind: 'create'; path: string; message: string }

// 'enriching' = the draft composer is fetching the LLM-tuned template to inject
// (editor dimmed + disabled meanwhile); on failure it drops to 'idle' with the
// static template left in place.
type Status = 'idle' | 'loading' | 'enriching' | 'saving' | 'published' | 'error'

interface EditorState {
  title: string
  value: string
  baseline: string // the pristine text (fetched file / template); value !== baseline ⇒ dirty
  restored?: boolean // value came from a recovered localStorage autosave, not the fetch
  mode: EditorMode | null // null while the file fetch is in flight
  status: Status
  errorText?: string
}

interface ContentEditorApi {
  /** Edit a content file's whole raw text (frontmatter + body) in a popup; `path` is repo-relative. */
  openFile: (opts: { title: string; path: string }) => void
  /** Compose a new content file (draft) at `path` from pre-filled template text. */
  openDraft: (opts: { title: string; path: string; initialValue: string; message: string }) => void
  /** Flip a post's `state` (no dialog) and propagate to the EN sibling per the
   *  RU→EN contract; `ref` comes from a content.ts provenance getter. */
  setPostState: (ref: EditRef, next: PostState) => Promise<void>
  /** Delete a post outright — and its sibling-locale file too (a git commit in prod, a working-tree remove in dev). */
  deleteFile: (path: string) => Promise<void>
}

const ContentEditorContext = createContext<ContentEditorApi | null>(null)

export function useContentEditor(): ContentEditorApi {
  const ctx = useContext(ContentEditorContext)
  if (!ctx) throw new Error('useContentEditor must be used within ContentEditorProvider')
  return ctx
}

// FRONTMATTER_RE (splits the `---` block from the body, delimiters kept so the
// body splices back byte-for-byte) lives in ./frontmatter now — imported above.

/**
 * Parse+edit ONE scalar in a standalone YAML string via CST-level surgery
 * (Parser → Composer with source tokens → setScalarValue on the ONE token →
 * re-serialize the original token stream). Everything except the edited
 * scalar — comments, folding, quoting, indentation — survives byte-for-byte.
 * (The higher-level Document.toString() would re-fold long block scalars,
 * churning the diff — that's why the CST route.) If the key doesn't exist yet
 * (e.g. an active post has no `state:` line — absent means active), a new
 * top-level `key: value` line is prepended instead; nested missing keys
 * aren't supported since nothing needs them today.
 */
function editYamlScalar(yamlText: string, path: EditRef['path'], newValue: string): string {
  const tokens = Array.from(new Parser().parse(yamlText))
  const docs = Array.from(new Composer({ keepSourceTokens: true }).compose(tokens))
  if (docs.length !== 1) throw new Error('expected exactly one YAML document')
  const doc = docs[0]
  if (doc.errors.length > 0) throw new Error(`source YAML parse failed: ${doc.errors[0].message}`)
  const node = doc.getIn(path, true)
  let out: string
  if (node === undefined) {
    if (path.length !== 1) throw new Error('cannot insert a missing nested key')
    out = `${String(path[0])}: ${newValue}\n${yamlText}`
  } else {
    if (!isScalar(node) || !node.srcToken) throw new Error('path is not an editable scalar')
    CST.setScalarValue(node.srcToken, newValue)
    out = tokens.map((t) => CST.stringify(t)).join('')
  }
  // Re-parse our own output before it goes anywhere near a commit (C3),
  // and confirm the edit actually landed at the path.
  const check = parseDocument(out)
  if (check.errors.length > 0) throw new Error(`edited YAML re-parse failed: ${check.errors[0].message}`)
  if (String(check.getIn(path)) !== newValue) throw new Error('edit did not apply cleanly')
  return out
}

/**
 * Apply one scalar change to a whole file's text. Plain YAML files
 * (site.yaml, themes.yaml) are edited whole; markdown content files
 * (products/journal/compass) have only their frontmatter block edited, with
 * the body spliced back untouched either side.
 */
function applyScalarEdit(fileText: string, ref: EditRef, newValue: string): string {
  const fm = FRONTMATTER_RE.exec(fileText)
  if (!fm) return editYamlScalar(fileText, ref.path, newValue)
  const [, open, yamlText, close, body] = fm
  return `${open}${editYamlScalar(yamlText, ref.path, newValue)}${close}${body}`
}

// Read one top-level frontmatter scalar as a string (undefined if absent) —
// used to pin the EN sibling's human-approved title/excerpt across re-syncs so
// the LLM can't re-word them differently each time.
function fmScalar(fileText: string, key: string): string | undefined {
  const m = FRONTMATTER_RE.exec(fileText)
  const v = parseDocument(m ? m[2] : fileText).get(key)
  return v == null ? undefined : String(v)
}

// Read a top-level frontmatter list of strings (empty if absent) — the gallery
// (`gallery: [/images/a.webp, …]`). setField writes it back as a flow seq.
function fmList(fileText: string, key: string): string[] {
  const m = FRONTMATTER_RE.exec(fileText)
  const v = (parseDocument(m ? m[2] : fileText).toJS() as Record<string, unknown> | null)?.[key]
  return Array.isArray(v) ? v.map(String) : []
}

// Return the first YAML error in a file's front-matter (or the whole doc for
// a plain-YAML file), or null if it parses. Blocks the raw-textarea save path
// from committing a broken `---` block that would blank the built SPA.
function frontmatterError(fileText: string): string | null {
  const m = FRONTMATTER_RE.exec(fileText)
  const doc = parseDocument(m ? m[2] : fileText)
  return doc.errors.length > 0 ? doc.errors[0].message : null
}

// Per-file autosave of in-progress edits to localStorage, so an accidental
// reload / tab-close / backdrop-close never loses a draft (the editor lives in
// React state alone, above <Routes>). Keyed by content path; written on every
// dirty keystroke, cleared on publish or when the text returns to pristine.
const DRAFT_PREFIX = 'gc-draft:'
const readDraft = (path: string): string | null => {
  try {
    return localStorage.getItem(DRAFT_PREFIX + path)
  } catch {
    return null
  }
}
const writeDraft = (path: string, value: string) => {
  try {
    localStorage.setItem(DRAFT_PREFIX + path, value)
  } catch {
    /* private mode / quota: autosave is best-effort, never block editing */
  }
}
const clearDraft = (path: string) => {
  try {
    localStorage.removeItem(DRAFT_PREFIX + path)
  } catch {
    /* ignore */
  }
}

// The same content file in the other locale (ru↔en), or null for a path with no
// locale segment. Used to keep a post's two locale files in lockstep on delete.
function siblingLocalePath(path: string): string | null {
  if (path.includes('/locales/ru/')) return path.replace('/locales/ru/', '/locales/en/')
  if (path.includes('/locales/en/')) return path.replace('/locales/en/', '/locales/ru/')
  return null
}

// The raw markdown body a preview should render — everything after the `---`
// frontmatter block (which is YAML, not prose). Plain-YAML files (site.yaml)
// have no frontmatter match, so the whole text is passed through (harmless: a
// preview of YAML is just not useful, and the toolbar/preview only matter for
// the markdown content files anyway).
const mdBody = (raw: string): string => {
  const m = FRONTMATTER_RE.exec(raw)
  return m ? m[4] : raw
}

// Inverse of mdBody: splice a new body back onto a file, keeping its `---`
// frontmatter block byte-for-byte. Lets the Fields view edit the body in a
// body-only textarea while the whole-file text stays the source of truth.
const withBody = (raw: string, body: string): string => {
  const m = FRONTMATTER_RE.exec(raw)
  return m ? `${m[1]}${m[2]}${m[3]}${body}` : body
}

type MdAction = 'bold' | 'h2' | 'ul' | 'link' | 'image'

/**
 * A markdown toolbar edit: given the textarea's value + selection, return the
 * new value and the selection to restore. Line actions (h2/ul) prefix every
 * line the selection touches; wrap actions (bold/link/image) wrap the selection
 * (or a placeholder when empty), and for link/image the caret lands on `url` so
 * the next keystroke replaces it.
 */
function applyMdAction(
  action: MdAction,
  value: string,
  s: number,
  e: number,
): { text: string; selStart: number; selEnd: number } {
  if (action === 'h2' || action === 'ul') {
    const prefix = action === 'h2' ? '## ' : '- '
    const lineStart = value.lastIndexOf('\n', s - 1) + 1
    const prefixed = value.slice(lineStart, e).replace(/^/gm, prefix)
    const text = value.slice(0, lineStart) + prefixed + value.slice(e)
    return { text, selStart: lineStart, selEnd: lineStart + prefixed.length }
  }
  const [before, after, placeholder] =
    action === 'bold'
      ? ['**', '**', 'text']
      : action === 'link'
        ? ['[', '](url)', 'text']
        : ['![', '](url)', 'alt']
  const body = value.slice(s, e) || placeholder
  const text = value.slice(0, s) + before + body + after + value.slice(e)
  if (action === 'link' || action === 'image') {
    const urlAt = s + before.length + body.length + 2 // past `](`
    return { text, selStart: urlAt, selEnd: urlAt + 3 } // select `url`
  }
  const bodyAt = s + before.length
  return { text, selStart: bodyAt, selEnd: bodyAt + body.length }
}

export function ContentEditorProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<EditorState | null>(null)
  // Fields = structured frontmatter + body textarea (the friendly default);
  // raw = whole-file textarea (escape hatch); preview = rendered body.
  const [view, setView] = useState<'fields' | 'raw' | 'preview'>('fields')
  // Collapse the frontmatter fields (+ image row) to give the body textarea the
  // whole pane. Default open on desktop (room for both); collapsed on mobile,
  // where the stacked chrome would otherwise leave the textarea a few lines tall.
  const [fieldsOpen, setFieldsOpen] = useState(() => window.innerWidth > 720)
  // Which target an open ImagePicker fills: the frontmatter cover or an appended
  // gallery image. null = closed.
  const [picker, setPicker] = useState<null | 'cover' | 'gallery'>(null)
  // Which image the frameless ImageFrame viewer/frame-editor is open on: the
  // cover, or a gallery entry by index. null = closed.
  const [framing, setFraming] = useState<null | { kind: 'cover' } | { kind: 'gallery'; index: number }>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const pendingSel = useRef<[number, number] | null>(null)
  const { token } = useEditMode()
  const { t, locale } = useI18n()

  // Dirty = the user has unsaved edits. Only meaningful while the editor is
  // interactive (idle/error) — a loading/saving/enriching/published editor is
  // never "dirty" for the purpose of the close guard or autosave.
  const dirty =
    !!state &&
    (state.status === 'idle' || state.status === 'error') &&
    state.value !== state.baseline

  // Autosave every dirty edit to localStorage (see readDraft/writeDraft); clear
  // it the moment the text is clean again (reverted or saved).
  useEffect(() => {
    if (!state?.mode) return
    if (dirty) writeDraft(state.mode.path, state.value)
    else clearDraft(state.mode.path)
  }, [state?.value, state?.mode, dirty])

  // Native "leave site?" prompt while a dirty editor is open, so a reflexive
  // Cmd-R / tab-close doesn't drop the open draft (autosave covers recovery,
  // this covers the surprise).
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  // Keep the editor sized to the visible viewport (above the mobile keyboard) —
  // see useVisibleViewportVars. Keyed on open/closed, not on every keystroke.
  useVisibleViewportVars(!!state)

  // Restore the caret/selection after a toolbar action re-renders the textarea
  // with new text (React controls the value, so the browser can't keep it).
  useEffect(() => {
    if (pendingSel.current && taRef.current) {
      const [s, e] = pendingSel.current
      pendingSel.current = null
      taRef.current.focus()
      taRef.current.setSelectionRange(s, e)
    }
  })

  // Auto-grow the Fields body textarea to its content (all widths), so the
  // fields and body scroll as ONE column (no second scrollbar) — on touch this
  // is what lets the drag chain to the fields scroller instead of scrolling the
  // textarea. Cross-browser stand-in for CSS field-sizing (Chromium-only).
  // Height = scrollHeight + borders: the textarea is border-box, so a bare
  // scrollHeight would leave ~2px (its 1px borders) of residual scroll —
  // enough for `overflow:hidden` to CAPTURE the wheel at the boundary instead of
  // chaining it to the fields scroller (the "stuck at the bottom over the body"
  // bug). offsetHeight-clientHeight is exactly those borders.
  useEffect(() => {
    const el = taRef.current
    if (!el || view !== 'fields') return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`
  }, [state?.value, view, fieldsOpen])

  // Chain the wheel from the auto-grown body textarea up to the fields scroller.
  // Blink latches the wheel onto a textarea even when it has zero scroll room and
  // whatever overscroll-behavior we set, so CSS alone can't stop the "sticks over
  // the body" effect — forward it by hand. preventDefault only when we actually
  // moved, so the true top/bottom of the whole scroller still behaves natively.
  useEffect(() => {
    const el = taRef.current
    if (!el || view !== 'fields') return
    const scroller = el.closest('.content-editor-fields') as HTMLElement | null
    if (!scroller) return
    const onWheel = (e: WheelEvent) => {
      const before = scroller.scrollTop
      scroller.scrollTop += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
      if (scroller.scrollTop !== before) e.preventDefault()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [view, fieldsOpen, state?.mode])

  // The active textarea holds the body (Fields view) or the whole file (Raw
  // view); both toolbar surgery and inline-image splicing operate on its text
  // and re-splice via `writeActive`.
  const writeActive = (nextText: string): string =>
    view === 'raw' ? nextText : withBody(state!.value, nextText)

  const applyMd = (action: MdAction) => {
    const ta = taRef.current
    if (!ta || !state) return
    const next = applyMdAction(action, ta.value, ta.selectionStart, ta.selectionEnd)
    pendingSel.current = [next.selStart, next.selEnd]
    setState({ ...state, value: writeActive(next.text) })
  }

  // IDE-style Tab in the textareas. A selection spanning newlines indents/outdents
  // every touched line as a block; otherwise Tab inserts two spaces at the caret
  // and Shift+Tab drops up to two spaces before it. Splices into the active text
  // and re-flows via writeActive, same as the toolbar edits.
  const onTabIndent = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Tab' || e.metaKey || e.ctrlKey || e.altKey) return
    const ta = taRef.current
    if (!ta || !state) return
    e.preventDefault()
    const { selectionStart: a, selectionEnd: b, value } = ta
    const commit = (text: string, sel: [number, number]) => {
      pendingSel.current = sel
      setState({ ...state, value: writeActive(text) })
    }

    if (value.slice(a, b).includes('\n')) {
      // Block mode: operate on every line from the start of the first selected
      // line through the caret end, keeping the whole block selected after.
      const from = value.lastIndexOf('\n', a - 1) + 1
      const lines = value.slice(from, b).split('\n')
      if (e.shiftKey) {
        let first = 0
        let total = 0
        const out = lines
          .map((l, i) => {
            const rm = (l.match(/^ {1,2}/)?.[0].length) ?? 0
            if (i === 0) first = rm
            total += rm
            return l.slice(rm)
          })
          .join('\n')
        if (!total) return
        commit(value.slice(0, from) + out + value.slice(b), [Math.max(from, a - first), b - total])
      } else {
        const out = lines.map((l) => '  ' + l).join('\n')
        commit(value.slice(0, from) + out + value.slice(b), [a + 2, b + 2 * lines.length])
      }
      return
    }

    if (e.shiftKey) {
      const strip = a - value.slice(0, a).replace(/ {1,2}$/, '').length
      if (!strip) return
      commit(value.slice(0, a - strip) + value.slice(a), [a - strip, b - strip])
    } else {
      commit(value.slice(0, a) + '  ' + value.slice(b), [a + 2, a + 2])
    }
  }

  // A structured frontmatter-field edit (Fields view): rewrite the one key via
  // setField, keeping comments + body intact. A malformed source surfaces.
  const onField = (key: string, next: FrontmatterField['value']) => {
    if (!state) return
    try {
      setState({ ...state, value: setField(state.value, key, next) })
    } catch (err) {
      setState({ ...state, status: 'error', errorText: err instanceof Error ? err.message : String(err) })
    }
  }

  // Commit one already-encoded WebP (base64, no data: prefix) to
  // frontend/public/images/ as its own git commit (POST /content/image),
  // returning the /images/<name>
  // path a post references. Names carry a base36 timestamp so writes never
  // collide (a reframe writes a fresh file, leaving the old one orphaned — cheap
  // vs. sha-guarded overwrite). Shared by file uploads and ImageFrame reframes.
  // Takes a full `data:` URI — extension follows the encoded mime (jpg on the
  // mobile-WebKit WebP fallback, else webp — see lib/image encodeLossy).
  const commitImageBase64 = async (dataUrl: string): Promise<string> => {
    const base =
      (fmScalar(state?.value ?? '', 'title') ?? state?.title ?? '')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'image'
    const ext = dataUrl.startsWith('data:image/jpeg') ? 'jpg' : 'webp'
    const name = `${base}-${Date.now().toString(36)}.${ext}`
    await uploadImage(`frontend/public/images/${name}`, dataUrl.split(',')[1] ?? '', token ?? undefined)
    return '/images/' + name
  }

  // Downscale a picked file in-browser, then commit it (the whole-frame path —
  // ImagePicker's "from your device" upload).
  const uploadFile = async (file: File): Promise<string> => {
    return commitImageBase64(await downscaleToWebP(file, 1400))
  }

  // Delete an image file from the repo (the picker's per-image ×). `path` is the
  // display path (/images/x.webp); the file lives at frontend/public/images/x.webp.
  // Posts still pointing at it fall back to the leaf placeholder — acknowledged.
  const deleteImage = async (path: string): Promise<void> => {
    await apiDelete<DeleteResponse>(
      '/content/file',
      { paths: [path.replace(/^\/images\//, 'frontend/public/images/')] },
      { token: token ?? undefined },
    )
  }

  // Put a chosen/uploaded image path where the picker was aimed: the cover sets
  // the frontmatter `image:` scalar (inserted if absent); gallery appends it.
  const applyImage = (path: string, target: 'cover' | 'gallery') => {
    if (!state) return
    try {
      if (target === 'cover') {
        setState({ ...state, value: applyScalarEdit(state.value, { file: '', path: ['image'] }, path) })
      } else {
        setState({ ...state, value: setField(state.value, 'gallery', [...fmList(state.value, 'gallery'), path]) })
      }
    } catch (err) {
      setState({ ...state, status: 'error', errorText: err instanceof Error ? err.message : String(err) })
    }
  }

  // Point the cover/gallery reference at `path` (a freshly-committed reframe, or
  // a clear when path is null). Cover clears via removeField (no `image: ''`);
  // a gallery clear splices the index out, dropping `gallery:` when it empties.
  const setImageRef = (where: { kind: 'cover' } | { kind: 'gallery'; index: number }, path: string | null) => {
    if (!state) return
    try {
      let value: string
      if (where.kind === 'cover') {
        value = path
          ? applyScalarEdit(state.value, { file: '', path: ['image'] }, path)
          : removeField(state.value, 'image')
      } else {
        const list = fmList(state.value, 'gallery')
        const next = path ? list.map((p, i) => (i === where.index ? path : p)) : list.filter((_, i) => i !== where.index)
        value = next.length ? setField(state.value, 'gallery', next) : removeField(state.value, 'gallery')
      }
      setState({ ...state, value })
    } catch (err) {
      setState({ ...state, status: 'error', errorText: err instanceof Error ? err.message : String(err) })
    }
  }

  // ImageFrame Save: commit the reframed crop as a fresh file, then repoint the
  // reference at it (the old file is orphaned — see commitImageBase64).
  const saveFraming = async (dataUrl: string) => {
    if (!framing) return
    setImageRef(framing, await commitImageBase64(dataUrl))
    setFraming(null)
  }

  const close = () => setState(null)

  // Backdrop / × close: confirm when there are unsaved edits, so a stray click
  // can't yank the editor away mid-thought. The draft is autosaved regardless,
  // so the copy reassures rather than threatens — which is why we SKIP the
  // confirm on touch: a coarse-pointer tap on × is deliberate, native confirm
  // is unreliable there (window.prompt is already a no-op in iOS standalone),
  // and a suppressed confirm returning false made the × feel dead. Nothing is
  // lost — the draft is restored next open.
  const attemptClose = () => {
    const touch = window.matchMedia('(pointer: coarse)').matches
    if (dirty && !touch && !window.confirm(t('editor.discardConfirm'))) return
    close()
  }

  // Esc closes the editor with the same discard-confirm as the × button — but
  // only when nothing sits on top of it (an open ImagePicker/ImageFrame owns Esc
  // and closes itself first).
  useEffect(() => {
    if (!state || picker || framing) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') attemptClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, picker, framing, dirty])

  // Drop a recovered autosave and fall back to the pristine fetched/template
  // text (the "discard draft" link on the restored banner).
  const discardRestored = () => {
    if (!state?.mode) return
    clearDraft(state.mode.path)
    setState({ ...state, value: state.baseline, restored: false })
  }

  // Dismiss the banner (×) but KEEP the recovered draft — just stop reminding.
  const dismissRestored = () => state && setState({ ...state, restored: false })

  const openFile: ContentEditorApi['openFile'] = ({ title, path }) => {
    setView('fields')
    setState({ title, value: '', baseline: '', mode: null, status: 'loading' })
    apiGet<ContentFile>(`/content/file?path=${encodeURIComponent(path)}`, {
      token: token ?? undefined,
    })
      .then((file) => {
        // Recover an autosaved draft over the fetched version if one differs.
        const saved = readDraft(path)
        const restored = saved != null && saved !== file.content
        setState({
          title,
          value: restored ? saved! : file.content,
          baseline: file.content,
          restored,
          mode: { kind: 'file', path, sha: file.sha },
          status: 'idle',
        })
      })
      .catch((err: unknown) => {
        setState({
          title,
          value: '',
          baseline: '',
          mode: null,
          status: 'error',
          errorText: err instanceof Error ? err.message : String(err),
        })
      })
  }

  const openDraft: ContentEditorApi['openDraft'] = ({ title, path, initialValue, message }) => {
    setView('fields')
    // A recovered autosave wins: skip enrichment (they already have their own
    // text) and reopen it dirty for saving. Baseline stays the blank template
    // so autosave/close-guard keep treating it as unsaved work.
    const saved = readDraft(path)
    if (saved != null) {
      setState({
        title,
        value: saved,
        baseline: initialValue,
        restored: true,
        mode: { kind: 'create', path, message },
        status: 'idle',
      })
      return
    }
    // Show the static template immediately, but dimmed + disabled while the LLM
    // re-tunes it (status 'enriching'). The editor is locked during the fetch,
    // so the tuned template always replaces the static one on success; any
    // failure (no model / BE down / 503) just unlocks the static template.
    setState({
      title,
      value: initialValue,
      baseline: initialValue,
      mode: { kind: 'create', path, message },
      status: 'enriching',
    })
    const stillEnriching = (s: EditorState | null) =>
      s && s.mode?.kind === 'create' && s.mode.path === path && s.status === 'enriching'
    enrichTemplate(title, initialValue, token ?? undefined)
      .then((raw) => {
        // Guard against a duplicated frontmatter key in the model output (a
        // second `tags:` line has shown up) — invalid YAML would blank the
        // Fields tab and block saving. dedupeFrontmatter is a no-op on clean text.
        const body = dedupeFrontmatter(raw)
        // Baseline tracks the enriched template too, so an untouched enrichment
        // isn't treated as a dirty draft (it'll just re-enrich next open).
        setState((s) => (stillEnriching(s) ? { ...s!, value: body, baseline: body, status: 'idle' } : s))
      })
      .catch(() => {
        setState((s) => (stillEnriching(s) ? { ...s!, status: 'idle' } : s))
      })
  }

  // Internal primitive: flip one YAML scalar in a file (fetch → CST edit →
  // save, retry once on 409). Public callers go through setPostState.
  const setScalar = async (ref: EditRef, newValue: string): Promise<void> => {
    const file = await apiGet<ContentFile>(`/content/file?path=${encodeURIComponent(ref.file)}`, {
      token: token ?? undefined,
    })
    const attempt = (fileText: string, sha: string) =>
      apiPost<SaveResponse>(
        '/content/save',
        { path: ref.file, content: applyScalarEdit(fileText, ref, newValue), sha },
        { token: token ?? undefined },
      )
    try {
      await attempt(file.content, file.sha)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Someone else committed since we fetched: re-fetch, re-apply onto
        // the fresh document, one retry.
        const fresh = await apiGet<ContentFile>(
          `/content/file?path=${encodeURIComponent(ref.file)}`,
          { token: token ?? undefined },
        )
        await attempt(fresh.content, fresh.sha)
        return
      }
      throw err
    }
  }

  // Delete a post outright — and its sibling-locale file too (a post lives in
  // both ru+en). Both paths go in ONE request so the backend removes them in a
  // single commit; it skips whichever doesn't exist.
  const deleteFile: ContentEditorApi['deleteFile'] = async (path) => {
    const paths = [path]
    const sibling = siblingLocalePath(path)
    if (sibling) paths.push(sibling)
    await apiDelete<DeleteResponse>('/content/file', { paths }, { token: token ?? undefined })
  }

  // RU→EN media mirror: a review/journal cover (`image:`) AND `gallery:` are
  // shared media, and RU is their source (SKILL.md #6). On saving an RU post,
  // return the EN sibling with both set to RU's — or null when there's nothing
  // to mirror (not an RU post, no cover/gallery, no EN sibling yet, or already
  // in sync). Inline body images are per-locale (the EN body is a separate
  // translation) and never mirror; only the frontmatter media does. The cover
  // is set-only (never cleared, preserving prior behavior); the gallery mirrors
  // exactly, clearing EN's when RU empties it.
  const enCoverMirror = async (
    ruPath: string,
    ruValue: string,
  ): Promise<{ path: string; content: string } | null> => {
    if (!/\/locales\/ru\/(products|journal)\//.test(ruPath)) return null
    const ruImage = fmScalar(ruValue, 'image')
    const ruGallery = fmList(ruValue, 'gallery')
    if (ruImage == null && ruGallery.length === 0) return null
    const enPath = ruPath.replace('/locales/ru/', '/locales/en/')
    let en: ContentFile
    try {
      en = await apiGet<ContentFile>(`/content/file?path=${encodeURIComponent(enPath)}`, {
        token: token ?? undefined,
      })
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null // no sibling yet; Active flip seeds it
      throw err
    }
    const imageInSync = ruImage == null || fmScalar(en.content, 'image') === ruImage
    const galleryInSync = JSON.stringify(fmList(en.content, 'gallery')) === JSON.stringify(ruGallery)
    if (imageInSync && galleryInSync) return null
    let content = en.content
    if (ruImage != null) content = applyScalarEdit(content, { file: enPath, path: ['image'] }, ruImage)
    content = ruGallery.length ? setField(content, 'gallery', ruGallery) : removeField(content, 'gallery')
    return { path: enPath, content }
  }

  const saveFile = async (mode: Extract<EditorMode, { kind: 'file' }>, value: string) => {
    // If the cover changed on an RU post, land it + the EN sibling's mirrored
    // cover in ONE commit (unguarded batch, like setPostState). Otherwise the
    // normal sha-guarded single save.
    const mirror = await enCoverMirror(mode.path, value)
    if (mirror) {
      await commitFiles([{ path: mode.path, content: value }, mirror], undefined, token ?? undefined)
      return
    }
    const attempt = (sha: string) =>
      apiPost<SaveResponse>(
        '/content/save',
        { path: mode.path, content: value, sha },
        { token: token ?? undefined },
      )
    try {
      await attempt(mode.sha)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Someone else committed since we fetched: re-fetch and retry the
        // same save once (the admin's text is already the whole desired file).
        const fresh = await apiGet<ContentFile>(
          `/content/file?path=${encodeURIComponent(mode.path)}`,
          { token: token ?? undefined },
        )
        try {
          await attempt(fresh.sha)
        } catch (err2) {
          if (err2 instanceof ApiError && err2.status === 409)
            throw new Error(t('editor.conflict'))
          throw err2
        }
      } else {
        throw err
      }
    }
    // Editing does NOT auto-translate — the RU→EN prose sync happens when a post
    // is flipped Active (setPostState), not on every save. (The cover is the one
    // exception, mirrored above, since it's shared media not prose.)
  }

  const saveDraft = async (mode: Extract<EditorMode, { kind: 'create' }>, value: string) => {
    // Pre-flight: refuse to overwrite an existing file (a 404 is the good case).
    let exists = false
    try {
      await apiGet<ContentFile>(`/content/file?path=${encodeURIComponent(mode.path)}`, {
        token: token ?? undefined,
      })
      exists = true
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) throw err
    }
    if (exists) throw new Error(t('editor.exists', { path: mode.path }))
    // A new draft + its sibling-locale skeleton land in ONE commit, so the other
    // locale's "in the works" rail shows it from the start. What the sibling
    // carries is asymmetric (see siblingSkeleton): a RU→EN sibling is
    // frontmatter-only (its body lands on the first Active flip); an EN→RU
    // sibling is the whole file translated — a real skeleton the owner refines
    // into the human source.
    const files = [{ path: mode.path, content: value }]
    const skeleton = await siblingSkeleton(mode.path, value)
    if (skeleton) files.push(skeleton)
    await commitFiles(files, mode.message, token ?? undefined)
  }

  // Build the sibling skeleton for a brand-new draft, committed with it. State
  // forced upcoming; translator offline ⇒ a verbatim copy so the stub still
  // exists. Null for a path outside products/journal. The two directions are
  // deliberately asymmetric in BOTH what they translate and how they're marked
  // (SKILL.md #6):
  //   RU→EN — a permanent machine EXPORT: FRONTMATTER ONLY (title/excerpt, one
  //     cheap call) so the EN rail entry reads in English; stamped
  //     `translatedFrom: ru`. The body is (re)translated on the first Active
  //     flip, so translating it now would just be thrown away.
  //   EN→RU — SCAFFOLDING the owner hand-finishes into the human source: the
  //     WHOLE enriched file, translated, so RU has a real draft to refine (a
  //     title-only stub left them nothing). Left unmarked — RU never carries an
  //     AI-translation mark. This is RU's ONLY machine assist: nothing else ever
  //     pushes EN prose into RU.
  // Seeding never overwrites an existing sibling (saveDraft's pre-flight refuses
  // that), so hand-written RU is safe.
  const siblingSkeleton = async (
    path: string,
    value: string,
  ): Promise<{ path: string; content: string } | null> => {
    const m = /\/locales\/(ru|en)\/(products|journal)\//.exec(path)
    if (!m) return null
    const from = m[1] as 'ru' | 'en'
    const to = from === 'ru' ? 'en' : 'ru'
    const siblingPath = path.replace(`/locales/${from}/`, `/locales/${to}/`)
    const fm = FRONTMATTER_RE.exec(value)
    let content: string
    try {
      if (!fm) throw new Error('draft has no frontmatter')
      // EN→RU translates the whole file (full skeleton); RU→EN just the
      // `---`-delimited frontmatter block (the body lands on the Active flip).
      const source = to === 'ru' ? value : `${fm[1]}${fm[2]}${fm[3]}`
      let out = await translateContent(source, to, token ?? undefined)
      if (!FRONTMATTER_RE.test(out)) throw new Error('translation returned no frontmatter')
      if (to === 'en') out = applyScalarEdit(out, { file: siblingPath, path: ['translatedFrom'] }, 'ru')
      out = applyScalarEdit(out, { file: siblingPath, path: ['state'] }, 'upcoming')
      content = out
    } catch {
      content = value // translator off/unreachable: verbatim copy so the stub exists
    }
    return { path: siblingPath, content }
  }

  // Flip a post's `state` and propagate to the EN sibling per the RU→EN
  // contract (SKILL.md #6). Only RU reviews/journal drive an EN counterpart —
  // RU is the source of truth, EN never pushes back:
  //   → active   : (re)translate the RU file into EN and force it active.
  //                title/excerpt pinned to the EXISTING EN wording (the LLM
  //                re-words prose each run; pinning stops that churn), while
  //                scores/price/tags/image come from RU — so a rating bump in RU
  //                lands in EN. Body freshly translated. A translation failure
  //                THROWS (surfaced by StateToggle). First activation: no EN yet,
  //                so the fresh translation IS the EN version.
  //   → upcoming : just mirror the state onto the EN sibling (no re-translation).
  // The RU state flip and the EN write land in ONE commit (commitFiles).
  // EN / en-only posts: just flip their own state (one sha-guarded file).
  const setPostState: ContentEditorApi['setPostState'] = async (ref, next) => {
    if (!/\/locales\/ru\/(products|journal)\//.test(ref.file)) {
      await setScalar(ref, next)
      return
    }
    const siblingPath = ref.file.replace('/locales/ru/', '/locales/en/')
    const ru = await apiGet<ContentFile>(`/content/file?path=${encodeURIComponent(ref.file)}`, {
      token: token ?? undefined,
    })
    const files = [{ path: ref.file, content: applyScalarEdit(ru.content, ref, next) }]

    // Existing EN sibling (if any): its title/excerpt to pin. 404 = none yet.
    let en: ContentFile | undefined
    try {
      en = await apiGet<ContentFile>(`/content/file?path=${encodeURIComponent(siblingPath)}`, {
        token: token ?? undefined,
      })
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) throw err
    }

    if (next === 'upcoming') {
      if (en)
        files.push({
          path: siblingPath,
          content: applyScalarEdit(en.content, { file: siblingPath, path: ['state'] }, 'upcoming'),
        })
    } else {
      let out = await translateContent(files[0].content, 'en', token ?? undefined)
      if (!FRONTMATTER_RE.test(out)) throw new Error('translation returned no frontmatter')
      out = applyScalarEdit(out, { file: siblingPath, path: ['translatedFrom'] }, 'ru')
      out = applyScalarEdit(out, { file: siblingPath, path: ['state'] }, 'active')
      if (en) {
        for (const key of ['title', 'excerpt'] as const) {
          const pinned = fmScalar(en.content, key)
          if (pinned != null) out = applyScalarEdit(out, { file: siblingPath, path: [key] }, pinned)
        }
      }
      files.push({ path: siblingPath, content: out })
    }
    await commitFiles(files, undefined, token ?? undefined)
  }

  // Shared tail for save/translate: flip to published (auto-closing after a
  // beat, unless a dialog was reopened meanwhile) or surface the error.
  const finish = (run: Promise<unknown>) => {
    run
      .then(() => {
        setState((s) => {
          if (s?.mode) clearDraft(s.mode.path) // published ⇒ the autosave is spent
          return s ? { ...s, status: 'published' } : s
        })
        window.setTimeout(
          () => setState((s) => (s && s.status === 'published' ? null : s)),
          2500,
        )
      })
      .catch((err: unknown) => {
        setState((s) =>
          s
            ? {
                ...s,
                status: 'error',
                errorText: err instanceof Error ? err.message : String(err),
              }
            : s,
        )
      })
  }

  const save = () => {
    if (!state?.mode || busy) return
    const { mode, value } = state
    const fmErr = frontmatterError(value)
    if (fmErr) {
      setState({ ...state, status: 'error', errorText: `${t('editor.badFrontmatter')} ${fmErr}` })
      return
    }
    setState({ ...state, status: 'saving', errorText: undefined })
    finish(mode.kind === 'file' ? saveFile(mode, value) : saveDraft(mode, value))
  }

  const api: ContentEditorApi = { openFile, openDraft, setPostState, deleteFile }
  const busy =
    state?.status === 'loading' ||
    state?.status === 'saving' ||
    state?.status === 'enriching'
  // Cmd/Ctrl+Enter saves the open post (skipped while the frame editor is up —
  // its own Cmd+Enter is on top of the stack and takes precedence).
  useCmdEnter(save, !!state?.mode && !busy && state.status !== 'published')
  // The cover control only makes sense for the two post types (reviews/journal
  // have an `image:` cover); compass/pages/site.yaml don't get it.
  const isPost = !!state?.mode && /\/(products|journal)\//.test(state.mode.path)
  const isReview = !!state?.mode && /\/products\//.test(state.mode.path)
  const cover = state ? fmScalar(state.value, 'image') : undefined
  const gallery = state ? fmList(state.value, 'gallery') : []
  // The post's own title (frontmatter `title:`), shown greyed on the collapsed
  // fields bar so you still see what you're editing without expanding it.
  const noteTitle = state ? fmScalar(state.value, 'title') : undefined
  // Labels for the `scores` field row (aligned to a review's scores by index).
  const scoreLabels = getSite(locale).ratingCriteria?.items ?? []

  // The cover + gallery image row (reviews/journal only). Rendered INSIDE the
  // Fields scroll column (under the ПОЛЯ И КАРТИНКИ bar), not as a separate
  // pinned strip, so images + fields + body scroll as ONE. The cover is the
  // special first slot («Обложка»); the rest are gallery images. A filled slot
  // opens the frame editor (view/reframe/delete); a ＋ slot opens the picker
  // (library + device). The gallery ＋ appears only once a cover exists.
  const imageRow = isPost ? (
    <div className="content-editor-cover">
      <div className="ce-image-row">
        {cover ? (
          <button
            type="button"
            className="ce-image-slot is-cover"
            disabled={busy || state?.status === 'published'}
            onClick={() => setFraming({ kind: 'cover' })}
          >
            <img src={withBase(cover)} alt="" />
            <span className="ce-image-label">{t('editor.cover')}</span>
          </button>
        ) : (
          <button
            type="button"
            className="ce-image-slot ce-image-add"
            disabled={busy || state?.status === 'published'}
            onClick={() => setPicker('cover')}
          >
            <span className="ce-image-plus" aria-hidden="true">＋</span>
            <span className="ce-image-label">{t('editor.cover')}</span>
          </button>
        )}
        {gallery.map((path, i) => (
          <button
            key={path + i}
            type="button"
            className="ce-image-slot"
            disabled={busy || state?.status === 'published'}
            onClick={() => setFraming({ kind: 'gallery', index: i })}
          >
            <img src={withBase(path)} alt="" />
          </button>
        ))}
        {(cover || gallery.length > 0) && (
          <button
            type="button"
            className="ce-image-slot ce-image-add"
            disabled={busy || state?.status === 'published'}
            onClick={() => setPicker('gallery')}
            title={t('editor.galleryAdd')}
          >
            <span className="ce-image-plus" aria-hidden="true">＋</span>
          </button>
        )}
      </div>
    </div>
  ) : null

  return (
    <ContentEditorContext.Provider value={api}>
      {children}
      {state && (
        <div className="content-editor-overlay" onClick={attemptClose}>
          <div
            className="content-editor"
            role="dialog"
            aria-label={state.title}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="content-editor-head">
              {noteTitle !== undefined ? (
                // Edit the post/page title right here (it's the frontmatter
                // `title:`); no separate Title field in the grid below.
                <input
                  className="content-editor-title-input"
                  value={noteTitle}
                  disabled={busy || state.status === 'published'}
                  aria-label={t('editor.field.title')}
                  onChange={(e) => onField('title', e.target.value)}
                />
              ) : (
                <p className="content-editor-title">{state.title}</p>
              )}
              <button
                type="button"
                className="content-editor-close"
                aria-label={t('editor.close')}
                onClick={attemptClose}
              >
                ×
              </button>
            </div>
            {state.restored && (
              <p className="content-editor-restored" role="status">
                <span>
                  {t('editor.draftRestored')}{' '}
                  <button type="button" className="linklike" onClick={discardRestored}>
                    {t('editor.draftDiscard')}
                  </button>
                </span>
                <button
                  type="button"
                  className="content-editor-close"
                  aria-label={t('editor.close')}
                  onClick={dismissRestored}
                >
                  ×
                </button>
              </p>
            )}
            <div className="content-editor-toolbar">
              <div className="content-editor-md" aria-hidden={view === 'preview'}>
                <button type="button" onClick={() => applyMd('bold')} title={t('editor.mdBold')}>
                  <b>B</b>
                </button>
                <button type="button" onClick={() => applyMd('h2')} title={t('editor.mdHeading')}>
                  H
                </button>
                <button type="button" onClick={() => applyMd('ul')} title={t('editor.mdList')}>
                  •
                </button>
                <button type="button" onClick={() => applyMd('link')} title={t('editor.mdLink')}>
                  🔗
                </button>
              </div>
              <div className="content-editor-tabs">
                <button
                  type="button"
                  className={view === 'fields' ? 'is-active' : ''}
                  onClick={() => setView('fields')}
                >
                  {t('editor.fields')}
                </button>
                {DEBUG && (
                  <button
                    type="button"
                    className={view === 'raw' ? 'is-active' : ''}
                    onClick={() => setView('raw')}
                  >
                    {t('editor.raw')}
                  </button>
                )}
                <button
                  type="button"
                  className={view === 'preview' ? 'is-active' : ''}
                  onClick={() => setView('preview')}
                >
                  {t('editor.preview')}
                </button>
              </div>
            </div>
            <div className="content-editor-body">
              {view === 'preview' ? (
                // Author-controlled content, same trust model as Markdown.tsx.
                <div
                  className="content-editor-preview prose"
                  dangerouslySetInnerHTML={{ __html: marked.parse(mdBody(state.value)) as string }}
                />
              ) : view === 'raw' ? (
                <textarea
                  ref={taRef}
                  className={`content-editor-textarea${state.status === 'enriching' ? ' is-dimmed' : ''}`}
                  value={state.value}
                  spellCheck={false}
                  disabled={busy || state.status === 'published'}
                  onKeyDown={onTabIndent}
                  onChange={(e) => setState({ ...state, value: e.target.value })}
                />
              ) : (
                // Fields: structured frontmatter + a body-only textarea. Both
                // write back into the whole-file `value` (setField / withBody).
                // The fields section collapses so the body can own the pane.
                <div className={`content-editor-fields${state.status === 'enriching' ? ' is-dimmed' : ''}`}>
                  <button
                    type="button"
                    className={`ce-fields-toggle${fieldsOpen ? ' is-open' : ''}`}
                    aria-expanded={fieldsOpen}
                    onClick={() => setFieldsOpen((o) => !o)}
                  >
                    <span className="side-chevron" aria-hidden="true" />
                    {t('editor.fieldsAndImages')}
                  </button>
                  {fieldsOpen && (
                    <>
                      {imageRow}
                      <FrontmatterFields
                        value={state.value}
                        scoreLabels={scoreLabels}
                        disabled={busy || state.status === 'published'}
                        hide={['title', 'state', ...(isPost ? ['image', 'gallery'] : [])]}
                        extraKeys={isReview ? ['boughtAt'] : undefined}
                        onEdit={onField}
                      />
                    </>
                  )}
                  <textarea
                    ref={taRef}
                    className="content-editor-textarea content-editor-body-textarea"
                    value={mdBody(state.value)}
                    spellCheck={false}
                    disabled={busy || state.status === 'published'}
                    onKeyDown={onTabIndent}
                    onChange={(e) => setState({ ...state, value: withBody(state.value, e.target.value) })}
                  />
                </div>
              )}
              {state.status === 'enriching' && (
                <div className="content-editor-enriching" aria-live="polite">
                  <span className="content-editor-spinner" aria-hidden="true" />
                  {t('editor.enriching')}
                </div>
              )}
            </div>
            <div className="content-editor-actions">
              {state.status === 'published' ? (
                <p className="content-editor-status">{t('editor.published')}</p>
              ) : state.status === 'error' ? (
                <p className="content-editor-status content-editor-error">
                  {t('editor.error')} {state.errorText}
                </p>
              ) : state.status === 'loading' ? (
                <p className="content-editor-status">{t('editor.loading')}</p>
              ) : null}
              <CopyButton
                value={state.value}
                className="content-editor-copy"
                ariaLabel={t('editor.copyAria')}
              />
              <button
                type="button"
                className="btn btn-primary content-editor-save"
                disabled={busy || state.status === 'published' || !state.mode}
                onClick={save}
              >
                {state.status === 'saving' ? t('editor.saving') : t('editor.save')}
              </button>
            </div>
          </div>
        </div>
      )}
      {state && picker && (
        // Sibling of the overlay (not a child) so its backdrop click closes
        // only the picker, never the editor beneath it.
        <ImagePicker
          onPick={(p) => applyImage(p, picker)}
          onClose={() => setPicker(null)}
          onUpload={uploadFile}
          onDelete={deleteImage}
        />
      )}
      {state && framing && (() => {
        const path = framing.kind === 'cover' ? cover : gallery[framing.index]
        if (!path) return null
        return (
          <ImageFrame
            src={path}
            onSave={saveFraming}
            onDelete={() => {
              setImageRef(framing, null)
              setFraming(null)
            }}
            onClose={() => setFraming(null)}
          />
        )
      })()}
    </ContentEditorContext.Provider>
  )
}
