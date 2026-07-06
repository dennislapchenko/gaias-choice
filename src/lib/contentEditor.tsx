// The live-edit popup (git-backed, live-edit-paths.md Path A). Two flows,
// both edit-mode-only (useEditMode) and both ending in a git commit through
// the backend's /api/content/* seam:
//
//  - FIELD: edit one YAML scalar in place. Fetches the CURRENT file (never
//    the stale built-in copy), shows just the scalar, and on Save performs
//    comment-preserving surgery with the yaml Document API — the whole
//    updated file + its sha go to /api/content/save. A sha conflict (409)
//    re-fetches and re-applies once before surfacing.
//  - CREATE: the draft composer. Pre-filled template text saved as a NEW
//    content file (create = save without sha); refuses to overwrite.
//
// Mounted once at the app root (see App.tsx), above <Routes> — never
// unmounted by client-side navigation, so an open draft survives following
// a link and coming back.
import { createContext, useContext, useState, type ReactNode } from 'react'
import { Composer, CST, isScalar, Parser, parseDocument } from 'yaml'
import CopyButton from '../components/CopyButton'
import { apiGet, apiPost, ApiError, type ContentFile, type SaveResponse } from './api'
import { useEditMode } from './editMode'
import { useI18n } from './i18n'
import type { EditRef } from './types'

type EditorMode =
  | { kind: 'field'; ref: EditRef; sha: string; fileText: string; onSaved?: (v: string) => void }
  | { kind: 'create'; path: string; message: string }

type Status = 'idle' | 'loading' | 'saving' | 'published' | 'error'

interface EditorState {
  title: string
  value: string
  mode: EditorMode | null // null while the field fetch is in flight
  status: Status
  errorText?: string
}

interface ContentEditorApi {
  /** Edit one YAML scalar in place; `ref` comes from a content.ts provenance getter. */
  openField: (opts: { title: string; ref: EditRef; onSaved?: (newValue: string) => void }) => void
  /** Compose a new content file (draft) at `path` from pre-filled template text. */
  openDraft: (opts: { title: string; path: string; initialValue: string; message: string }) => void
}

const ContentEditorContext = createContext<ContentEditorApi | null>(null)

export function useContentEditor(): ContentEditorApi {
  const ctx = useContext(ContentEditorContext)
  if (!ctx) throw new Error('useContentEditor must be used within ContentEditorProvider')
  return ctx
}

/**
 * Apply one scalar change to file text with true byte preservation: CST-level
 * surgery (Parser → Composer with source tokens → setScalarValue on the ONE
 * token → re-serialize the original token stream). Everything except the
 * edited scalar — comments, folding, quoting, indentation — survives
 * byte-for-byte. (The higher-level Document.toString() would re-fold long
 * block scalars, churning the diff — that's why the CST route.)
 */
function applyScalarEdit(fileText: string, ref: EditRef, newValue: string): string {
  const tokens = Array.from(new Parser().parse(fileText))
  const docs = Array.from(new Composer({ keepSourceTokens: true }).compose(tokens))
  if (docs.length !== 1) throw new Error('expected exactly one YAML document')
  const doc = docs[0]
  if (doc.errors.length > 0) throw new Error(`source YAML parse failed: ${doc.errors[0].message}`)
  const node = doc.getIn(ref.path, true)
  if (!isScalar(node) || !node.srcToken) throw new Error('path is not an editable scalar')
  CST.setScalarValue(node.srcToken, newValue)
  const out = tokens.map((t) => CST.stringify(t)).join('')
  // Re-parse our own output before it goes anywhere near a commit (C3),
  // and confirm the edit actually landed at the path.
  const check = parseDocument(out)
  if (check.errors.length > 0) throw new Error(`edited YAML re-parse failed: ${check.errors[0].message}`)
  if (String(check.getIn(ref.path)) !== newValue) throw new Error('edit did not apply cleanly')
  return out
}

export function ContentEditorProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<EditorState | null>(null)
  const { token } = useEditMode()
  const { t } = useI18n()

  const close = () => setState(null)

  const openField: ContentEditorApi['openField'] = ({ title, ref, onSaved }) => {
    setState({ title, value: '', mode: null, status: 'loading' })
    apiGet<ContentFile>(`/content/file?path=${encodeURIComponent(ref.file)}`, {
      token: token ?? undefined,
    })
      .then((file) => {
        const doc = parseDocument(file.content)
        const cur = doc.getIn(ref.path)
        setState({
          title,
          value: cur === undefined || cur === null ? '' : String(cur),
          mode: { kind: 'field', ref, sha: file.sha, fileText: file.content, onSaved },
          status: 'idle',
        })
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
  }

  const saveField = async (mode: Extract<EditorMode, { kind: 'field' }>, value: string) => {
    const attempt = (fileText: string, sha: string) =>
      apiPost<SaveResponse>(
        '/content/save',
        { path: mode.ref.file, content: applyScalarEdit(fileText, mode.ref, value), sha },
        { token: token ?? undefined },
      )
    try {
      await attempt(mode.fileText, mode.sha)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Someone else committed since we fetched: re-fetch, re-apply onto
        // the fresh document, one retry.
        const fresh = await apiGet<ContentFile>(
          `/content/file?path=${encodeURIComponent(mode.ref.file)}`,
          { token: token ?? undefined },
        )
        try {
          await attempt(fresh.content, fresh.sha)
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
    const run = mode.kind === 'field' ? saveField(mode, value) : saveDraft(mode, value)
    run
      .then(() => {
        if (mode.kind === 'field') mode.onSaved?.(value)
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

  const api: ContentEditorApi = { openField, openDraft }
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
