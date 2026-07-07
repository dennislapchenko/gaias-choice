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
//  - setScalar: no dialog — flips one YAML scalar directly (e.g. a post's
//    `state`). Performs CST-level byte-preserving surgery — on the whole file
//    for plain YAML (site.yaml, themes.yaml), or just the `---` frontmatter
//    block for markdown content files, body spliced back untouched (see
//    FRONTMATTER_RE/applyScalarEdit). If the key is entirely absent (e.g. an
//    active post has no `state:` line), it's inserted rather than requiring
//    the key to preexist.
//
// Mounted once at the app root (see App.tsx), above <Routes> — never
// unmounted by client-side navigation, so an open draft survives following
// a link and coming back.
import { createContext, useContext, useState, type ReactNode } from 'react'
import { Composer, CST, isScalar, Parser, parseDocument } from 'yaml'
import CopyButton from '../components/CopyButton'
import { apiGet, apiPost, ApiError, enrichTemplate, type ContentFile, type SaveResponse } from './api'
import { useEditMode } from './editMode'
import { useI18n } from './i18n'
import type { EditRef } from './types'

type EditorMode =
  | { kind: 'file'; path: string; sha: string }
  | { kind: 'create'; path: string; message: string }

type Status = 'idle' | 'loading' | 'saving' | 'published' | 'error'

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
  /** Flip one YAML scalar directly, no dialog; `ref` comes from a content.ts provenance getter. */
  setScalar: (ref: EditRef, newValue: string) => Promise<void>
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

export function ContentEditorProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<EditorState | null>(null)
  const { token } = useEditMode()
  const { t } = useI18n()

  const close = () => setState(null)

  const openFile: ContentEditorApi['openFile'] = ({ title, path }) => {
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
    setState({
      title,
      value: initialValue,
      mode: { kind: 'create', path, message },
      status: 'idle',
    })
    // Progressive enhancement: ask the backend to re-tune the template's
    // prompts to this title (LLM). Swap it in only if the admin hasn't started
    // typing yet; any failure (no model configured / BE down / 503) just leaves
    // the static template in place.
    enrichTemplate(title, initialValue, token ?? undefined)
      .then((body) => {
        setState((s) =>
          s && s.mode?.kind === 'create' && s.mode.path === path && s.value === initialValue
            ? { ...s, value: body }
            : s,
        )
      })
      .catch(() => {})
  }

  const setScalar: ContentEditorApi['setScalar'] = async (ref, newValue) => {
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
        return
      }
      throw err
    }
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
  }

  const save = () => {
    if (!state?.mode || state.status === 'saving') return
    const { mode, value } = state
    setState({ ...state, status: 'saving', errorText: undefined })
    const run = mode.kind === 'file' ? saveFile(mode, value) : saveDraft(mode, value)
    run
      .then(() => {
        setState((s) => (s ? { ...s, status: 'published' } : s))
        // Auto-close the confirmation — but only if the dialog is still
        // showing it (a dialog reopened within the delay must survive).
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

  const api: ContentEditorApi = { openFile, openDraft, setScalar }
  const busy = state?.status === 'loading' || state?.status === 'saving'

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
            <textarea
              className="content-editor-textarea"
              value={state.value}
              spellCheck={false}
              disabled={busy || state.status === 'published'}
              onChange={(e) => setState({ ...state, value: e.target.value })}
            />
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
