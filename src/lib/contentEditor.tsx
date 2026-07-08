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
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { marked } from 'marked'
import { Composer, CST, isScalar, Parser, parseDocument } from 'yaml'
import CopyButton from '../components/CopyButton'
import ImagePicker from '../components/ImagePicker'
import FrontmatterFields from '../components/FrontmatterFields'
import { withBase } from './asset'
import { getSite } from './content'
import { FRONTMATTER_RE, setField, type FrontmatterField } from './frontmatter'
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
  // Collapse the frontmatter fields to give the body textarea the whole pane.
  const [fieldsOpen, setFieldsOpen] = useState(true)
  // Which target an open ImagePicker fills: the frontmatter cover, or an inline
  // ![]() at the caret. null = closed.
  const [picker, setPicker] = useState<null | 'cover' | 'inline'>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const pendingSel = useRef<[number, number] | null>(null)
  // The textarea selection captured when the inline image picker opened (the
  // modal steals focus, so we can't read it back on pick).
  const inlineAt = useRef<[number, number] | null>(null)
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

  // Downscale a picked file in-browser and commit it to public/images/ as its
  // own git commit (POST /content/image), returning the /images/<name> path a
  // post references. Names carry a base36 timestamp so uploads never collide.
  const uploadFile = async (file: File): Promise<string> => {
    const dataUrl = await downscaleToWebP(file, 1400)
    const base64 = dataUrl.split(',')[1] ?? ''
    const base =
      (state?.title ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') ||
      'image'
    const name = `${base}-${Date.now().toString(36)}.webp`
    await uploadImage(`public/images/${name}`, base64, token ?? undefined)
    return '/images/' + name
  }

  // Put a chosen/uploaded image path where the picker was aimed: the cover sets
  // the frontmatter `image:` scalar (inserted if absent); inline splices an
  // ![](path) at the caret captured when the picker opened.
  const applyImage = (path: string, target: 'cover' | 'inline') => {
    if (!state) return
    try {
      if (target === 'cover') {
        setState({ ...state, value: applyScalarEdit(state.value, { file: '', path: ['image'] }, path) })
      } else {
        // Splice into whichever text the active textarea shows (body vs whole).
        const base = view === 'raw' ? state.value : mdBody(state.value)
        const [a, b] = inlineAt.current ?? [base.length, base.length]
        const spliced = base.slice(0, a) + `![](${path})` + base.slice(b)
        pendingSel.current = [a + 2, a + 2] // caret inside the alt brackets
        setState({ ...state, value: writeActive(spliced) })
      }
    } catch (err) {
      setState({ ...state, status: 'error', errorText: err instanceof Error ? err.message : String(err) })
    }
  }

  const openInlinePicker = () => {
    const ta = taRef.current
    inlineAt.current = ta ? [ta.selectionStart, ta.selectionEnd] : null
    setPicker('inline')
  }

  const close = () => setState(null)

  // Backdrop / × close: confirm when there are unsaved edits, so a stray click
  // can't yank the editor away mid-thought. The draft is autosaved regardless,
  // so the copy reassures rather than threatens.
  const attemptClose = () => {
    if (dirty && !window.confirm(t('editor.discardConfirm'))) return
    close()
  }

  // Drop a recovered autosave and fall back to the pristine fetched/template
  // text (the "discard draft" link on the restored banner).
  const discardRestored = () => {
    if (!state?.mode) return
    clearDraft(state.mode.path)
    setState({ ...state, value: state.baseline, restored: false })
  }

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
      .then((body) => {
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

  // RU→EN cover mirror: a review/journal `image:` is shared media, and RU is
  // its source (SKILL.md #6). On saving an RU post, return the EN sibling with
  // its cover set to RU's — or null when there's nothing to mirror (not an RU
  // post, no cover set, no EN sibling yet, or already in sync). Inline body
  // images are per-locale (the EN body is a separate translation) and never
  // mirror; only the frontmatter `image:` scalar does.
  const enCoverMirror = async (
    ruPath: string,
    ruValue: string,
  ): Promise<{ path: string; content: string } | null> => {
    if (!/\/locales\/ru\/(products|journal)\//.test(ruPath)) return null
    const ruImage = fmScalar(ruValue, 'image')
    if (ruImage == null) return null
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
    if (fmScalar(en.content, 'image') === ruImage) return null
    return { path: enPath, content: applyScalarEdit(en.content, { file: enPath, path: ['image'] }, ruImage) }
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
    // A new RU draft + its EN sibling skeleton land in ONE commit: the sibling
    // exists from the start (so the EN "in the works" rail shows it), with only
    // its title/excerpt translated — the body is fully translated later, when
    // the post is first flipped Active. See siblingSkeleton.
    const files = [{ path: mode.path, content: value }]
    const skeleton = await siblingSkeleton(mode.path, value)
    if (skeleton) files.push(skeleton)
    await commitFiles(files, mode.message, token ?? undefined)
  }

  // Build the EN sibling skeleton for a brand-new RU draft: translate the
  // FRONTMATTER ONLY (title/excerpt — one cheap call) so the rail entry reads in
  // English, leaving the body skeletal (the real body translation lands on the
  // first Active flip). Stamped translatedFrom, state forced upcoming. Translator
  // offline ⇒ a verbatim copy so the stub still exists. Only RU→EN (EN never
  // drives RU); null for a non-RU path. Committed together with the RU draft.
  const siblingSkeleton = async (
    path: string,
    value: string,
  ): Promise<{ path: string; content: string } | null> => {
    if (!/\/locales\/ru\/(products|journal)\//.test(path)) return null
    const siblingPath = path.replace('/locales/ru/', '/locales/en/')
    const fm = FRONTMATTER_RE.exec(value)
    let content: string
    try {
      if (!fm) throw new Error('draft has no frontmatter')
      // Translate just the `---`-delimited frontmatter block (no body).
      let out = await translateContent(`${fm[1]}${fm[2]}${fm[3]}`, 'en', token ?? undefined)
      if (!FRONTMATTER_RE.test(out)) throw new Error('translation returned no frontmatter')
      out = applyScalarEdit(out, { file: siblingPath, path: ['translatedFrom'] }, 'ru')
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
  // The cover control only makes sense for the two post types (reviews/journal
  // have an `image:` cover); compass/pages/site.yaml don't get it.
  const isPost = !!state?.mode && /\/(products|journal)\//.test(state.mode.path)
  const cover = state ? fmScalar(state.value, 'image') : undefined
  // Labels for the `scores` field row (aligned to a review's scores by index).
  const scoreLabels = getSite(locale).ratingCriteria?.items ?? []

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
              <p className="content-editor-title">{state.title}</p>
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
                {t('editor.draftRestored')}{' '}
                <button type="button" className="linklike" onClick={discardRestored}>
                  {t('editor.draftDiscard')}
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
                <button type="button" onClick={openInlinePicker} title={t('editor.mdImage')}>
                  🖼
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
                <button
                  type="button"
                  className={view === 'raw' ? 'is-active' : ''}
                  onClick={() => setView('raw')}
                >
                  {t('editor.raw')}
                </button>
                <button
                  type="button"
                  className={view === 'preview' ? 'is-active' : ''}
                  onClick={() => setView('preview')}
                >
                  {t('editor.preview')}
                </button>
              </div>
            </div>
            {isPost && (
              <div className="content-editor-cover">
                <div className="content-editor-cover-thumb">
                  {cover ? (
                    <img src={withBase(cover)} alt="" />
                  ) : (
                    <span aria-hidden="true">🌿</span>
                  )}
                </div>
                <div className="content-editor-cover-actions">
                  <span className="side-label">{t('editor.cover')}</span>
                  <div>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={busy || state.status === 'published'}
                      onClick={() => setPicker('cover')}
                    >
                      {t('editor.coverSet')}
                    </button>
                  </div>
                </div>
              </div>
            )}
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
                  onChange={(e) => setState({ ...state, value: e.target.value })}
                />
              ) : (
                // Fields: structured frontmatter + a body-only textarea. Both
                // write back into the whole-file `value` (setField / withBody).
                // The fields section collapses so the body can own the pane.
                <div className={`content-editor-fields${state.status === 'enriching' ? ' is-dimmed' : ''}`}>
                  <button
                    type="button"
                    className="ce-fields-toggle"
                    aria-expanded={fieldsOpen}
                    onClick={() => setFieldsOpen((o) => !o)}
                  >
                    <span className="ce-fields-chevron" aria-hidden="true">
                      {fieldsOpen ? '▾' : '▸'}
                    </span>
                    {t('editor.fields')}
                  </button>
                  {fieldsOpen && (
                    <FrontmatterFields
                      value={state.value}
                      scoreLabels={scoreLabels}
                      disabled={busy || state.status === 'published'}
                      hide={isPost ? ['image'] : undefined}
                      onEdit={onField}
                    />
                  )}
                  <span className="side-label ce-body-label">{t('editor.body')}</span>
                  <textarea
                    ref={taRef}
                    className="content-editor-textarea content-editor-body-textarea"
                    value={mdBody(state.value)}
                    spellCheck={false}
                    disabled={busy || state.status === 'published'}
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
        />
      )}
    </ContentEditorContext.Provider>
  )
}
