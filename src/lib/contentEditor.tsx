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
import {
  apiDelete,
  apiGet,
  apiPost,
  ApiError,
  enrichTemplate,
  translateContent,
  type ContentFile,
  type DeleteResponse,
  type SaveResponse,
} from './api'
import { useEditMode } from './editMode'
import { useI18n } from './i18n'
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
  /** Delete a content file outright (a git commit in prod, a working-tree remove in dev). */
  deleteFile: (path: string) => Promise<void>
}

const ContentEditorContext = createContext<ContentEditorApi | null>(null)

export function useContentEditor(): ContentEditorApi {
  const ctx = useContext(ContentEditorContext)
  if (!ctx) throw new Error('useContentEditor must be used within ContentEditorProvider')
  return ctx
}

// Splits `---`-delimited frontmatter from a markdown file's body, keeping the
// delimiters themselves so the edited YAML can be spliced back byte-for-byte
// (content.ts's own parseFrontmatter discards them — it only needs the parsed
// data, never reconstructs the file). Files with no frontmatter (site.yaml,
// themes.yaml) don't match, and are treated as one whole YAML document.
const FRONTMATTER_RE = /^(---\r?\n)([\s\S]*?)(\r?\n---\r?\n?)([\s\S]*)$/

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

// The raw markdown body a preview should render — everything after the `---`
// frontmatter block (which is YAML, not prose). Plain-YAML files (site.yaml)
// have no frontmatter match, so the whole text is passed through (harmless: a
// preview of YAML is just not useful, and the toolbar/preview only matter for
// the markdown content files anyway).
const mdBody = (raw: string): string => {
  const m = FRONTMATTER_RE.exec(raw)
  return m ? m[4] : raw
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
  const [view, setView] = useState<'write' | 'preview'>('write')
  const taRef = useRef<HTMLTextAreaElement>(null)
  const pendingSel = useRef<[number, number] | null>(null)
  const { token } = useEditMode()
  const { t } = useI18n()

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

  const applyMd = (action: MdAction) => {
    const ta = taRef.current
    if (!ta || !state) return
    const next = applyMdAction(action, ta.value, ta.selectionStart, ta.selectionEnd)
    pendingSel.current = [next.selStart, next.selEnd]
    setState({ ...state, value: next.text })
  }

  const close = () => setState(null)

  const openFile: ContentEditorApi['openFile'] = ({ title, path }) => {
    setView('write')
    setState({ title, value: '', mode: null, status: 'loading' })
    apiGet<ContentFile>(`/content/file?path=${encodeURIComponent(path)}`, {
      token: token ?? undefined,
    })
      .then((file) => {
        setState({ title, value: file.content, mode: { kind: 'file', path, sha: file.sha }, status: 'idle' })
      })
      .catch((err: unknown) => {
        setState({
          title,
          value: '',
          mode: null,
          status: 'error',
          errorText: err instanceof Error ? err.message : String(err),
        })
      })
  }

  const openDraft: ContentEditorApi['openDraft'] = ({ title, path, initialValue, message }) => {
    setView('write')
    // Show the static template immediately, but dimmed + disabled while the LLM
    // re-tunes it (status 'enriching'). The editor is locked during the fetch,
    // so the tuned template always replaces the static one on success; any
    // failure (no model / BE down / 503) just unlocks the static template.
    setState({
      title,
      value: initialValue,
      mode: { kind: 'create', path, message },
      status: 'enriching',
    })
    const stillEnriching = (s: EditorState | null) =>
      s && s.mode?.kind === 'create' && s.mode.path === path && s.status === 'enriching'
    enrichTemplate(title, initialValue, token ?? undefined)
      .then((body) => {
        setState((s) => (stillEnriching(s) ? { ...s!, value: body, status: 'idle' } : s))
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

  // Delete outright — same fetch-sha-then-write, retry-once-on-409 shape as
  // setScalar/saveFile, just ending in a DELETE instead of a save.
  const deleteFile: ContentEditorApi['deleteFile'] = async (path) => {
    const file = await apiGet<ContentFile>(`/content/file?path=${encodeURIComponent(path)}`, {
      token: token ?? undefined,
    })
    const attempt = (sha: string) =>
      apiDelete<DeleteResponse>(
        `/content/file?path=${encodeURIComponent(path)}&sha=${encodeURIComponent(sha)}`,
        { token: token ?? undefined },
      )
    try {
      await attempt(file.sha)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const fresh = await apiGet<ContentFile>(`/content/file?path=${encodeURIComponent(path)}`, {
          token: token ?? undefined,
        })
        await attempt(fresh.sha)
        return
      }
      throw err
    }
  }

  const saveFile = async (mode: Extract<EditorMode, { kind: 'file' }>, value: string) => {
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
    // Editing does NOT auto-translate — the RU→EN sync happens when a post is
    // flipped Active (setPostState), not on every content save.
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
    await apiPost<SaveResponse>(
      '/content/save',
      { path: mode.path, content: value, message: mode.message },
      { token: token ?? undefined },
    )
    // A new RU draft auto-seeds its EN sibling so both locales exist (and the EN
    // "in the works" rail shows it) from the start — see seedSibling.
    await seedSibling(mode.path, value)
  }

  // Seed the EN sibling of a brand-new RU draft. Best-effort: an LLM translation
  // (stamped translatedFrom) when the model's up, else a verbatim copy so the
  // stub still lands. Only RU→EN (EN never drives RU); the EN title/excerpt this
  // establishes is what later Active flips pin to. No sha — the draft is new, so
  // the sibling is too (create).
  const seedSibling = async (path: string, value: string) => {
    if (!/\/locales\/ru\/(products|journal)\//.test(path)) return
    const siblingPath = path.replace('/locales/ru/', '/locales/en/')
    let out: string
    try {
      out = await translateContent(value, 'en', token ?? undefined)
      if (!FRONTMATTER_RE.test(out)) throw new Error('translation returned no frontmatter')
      out = applyScalarEdit(out, { file: siblingPath, path: ['translatedFrom'] }, 'ru')
    } catch {
      out = value // translator off/unreachable: verbatim copy so the stub exists
    }
    await apiPost<SaveResponse>(
      '/content/save',
      { path: siblingPath, content: out, message: `content: seed ${siblingPath}` },
      { token: token ?? undefined },
    )
  }

  // Flip a post's `state` and propagate to the EN sibling per the RU→EN
  // contract (SKILL.md #6). Only RU reviews/journal drive an EN counterpart —
  // RU is the source of truth, EN never pushes back:
  //   → active   : (re)translate the CURRENT RU file into EN and force it active.
  //                title/excerpt are pinned to the EXISTING EN wording (the LLM
  //                re-words prose on every run; pinning stops that churn), while
  //                scores/price/tags/image come straight from RU — so a rating
  //                bump in RU still lands in EN. The body is freshly translated.
  //                A translation failure THROWS (surfaced by StateToggle) — no
  //                silent copy. On first activation EN doesn't exist yet, so the
  //                fresh translation IS the EN version.
  //   → upcoming : just mirror the state onto the EN sibling; never re-translate
  //                content when a post is pulled back to WIP.
  // EN / en-only posts: only the toggled file's own state flips (done above).
  // Each sibling save is its own git commit.
  const setPostState: ContentEditorApi['setPostState'] = async (ref, next) => {
    await setScalar(ref, next) // the toggled post's own state, first
    if (!/\/locales\/ru\/(products|journal)\//.test(ref.file)) return
    const siblingPath = ref.file.replace('/locales/ru/', '/locales/en/')

    // The existing EN sibling (if any): its sha for a safe in-place update, and
    // its title/excerpt to pin. 404 = none yet (first activation creates it).
    let en: ContentFile | undefined
    try {
      en = await apiGet<ContentFile>(`/content/file?path=${encodeURIComponent(siblingPath)}`, {
        token: token ?? undefined,
      })
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) throw err
    }
    const saveSibling = (content: string) =>
      apiPost<SaveResponse>(
        '/content/save',
        { path: siblingPath, content, sha: en?.sha, message: `content: sync ${siblingPath}` },
        { token: token ?? undefined },
      )

    if (next === 'upcoming') {
      // Nothing to pull back if EN was never created; else flip its state only.
      if (en) await saveSibling(applyScalarEdit(en.content, { file: siblingPath, path: ['state'] }, 'upcoming'))
      return
    }

    // active: (re)translate the current RU file (state already flipped to active).
    const ru = await apiGet<ContentFile>(`/content/file?path=${encodeURIComponent(ref.file)}`, {
      token: token ?? undefined,
    })
    let out = await translateContent(ru.content, 'en', token ?? undefined)
    if (!FRONTMATTER_RE.test(out)) throw new Error('translation returned no frontmatter')
    out = applyScalarEdit(out, { file: siblingPath, path: ['translatedFrom'] }, 'ru')
    out = applyScalarEdit(out, { file: siblingPath, path: ['state'] }, 'active')
    if (en) {
      for (const key of ['title', 'excerpt'] as const) {
        const pinned = fmScalar(en.content, key)
        if (pinned != null) out = applyScalarEdit(out, { file: siblingPath, path: [key] }, pinned)
      }
    }
    await saveSibling(out)
  }

  // Shared tail for save/translate: flip to published (auto-closing after a
  // beat, unless a dialog was reopened meanwhile) or surface the error.
  const finish = (run: Promise<unknown>) => {
    run
      .then(() => {
        setState((s) => (s ? { ...s, status: 'published' } : s))
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
    setState({ ...state, status: 'saving', errorText: undefined })
    finish(mode.kind === 'file' ? saveFile(mode, value) : saveDraft(mode, value))
  }

  const api: ContentEditorApi = { openFile, openDraft, setPostState, deleteFile }
  const busy =
    state?.status === 'loading' ||
    state?.status === 'saving' ||
    state?.status === 'enriching'

  return (
    <ContentEditorContext.Provider value={api}>
      {children}
      {state && (
        <div className="content-editor-overlay" onClick={close}>
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
                onClick={close}
              >
                ×
              </button>
            </div>
            <div className="content-editor-toolbar">
              <div className="content-editor-md" aria-hidden={view !== 'write'}>
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
                <button type="button" onClick={() => applyMd('image')} title={t('editor.mdImage')}>
                  🖼
                </button>
              </div>
              <div className="content-editor-tabs">
                <button
                  type="button"
                  className={view === 'write' ? 'is-active' : ''}
                  onClick={() => setView('write')}
                >
                  {t('editor.write')}
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
            <div className="content-editor-body">
              {view === 'write' ? (
                <textarea
                  ref={taRef}
                  className={`content-editor-textarea${state.status === 'enriching' ? ' is-dimmed' : ''}`}
                  value={state.value}
                  spellCheck={false}
                  disabled={busy || state.status === 'published'}
                  onChange={(e) => setState({ ...state, value: e.target.value })}
                />
              ) : (
                // Author-controlled content, same trust model as Markdown.tsx.
                <div
                  className="content-editor-preview prose"
                  dangerouslySetInnerHTML={{ __html: marked.parse(mdBody(state.value)) as string }}
                />
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
    </ContentEditorContext.Provider>
  )
}
