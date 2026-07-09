// The live-edit seam's THIN shell: the context + useContentEditor hook that
// reader-facing components import (EditButton callers, StateToggle, Upcoming,
// the detail pages), kept tiny so it rides the main chunk. The actual editor —
// dialogs, yaml CST surgery, image tooling — is ./contentEditorImpl, a lazy
// chunk mounted ONLY while edit mode is active (admin/editor signed in with a
// configured backend). Readers never download it.
//
// Mounted once at the app root (see App.tsx), above <Routes>, so an open
// draft survives client-side navigation.
import { createContext, lazy, Suspense, useContext, useState, type ReactNode } from 'react'
import { useEditMode } from './editMode'
import type { EditRef, PostState } from './types'

export interface ContentEditorApi {
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

// Reachable only in the beat between edit mode activating and the impl chunk
// arriving — the chrome that calls these renders only while active, so a
// click in that window is a silent no-op, never a crash.
const inertApi: ContentEditorApi = {
  openFile: () => {},
  openDraft: () => {},
  setPostState: async () => {},
  deleteFile: async () => {},
}

const ContentEditorContext = createContext<ContentEditorApi | null>(null)

export function useContentEditor(): ContentEditorApi {
  const ctx = useContext(ContentEditorContext)
  if (!ctx) throw new Error('useContentEditor must be used within ContentEditorProvider')
  return ctx
}

const EditorImpl = lazy(() => import('./contentEditorImpl'))

export function ContentEditorProvider({ children }: { children: ReactNode }) {
  const { active } = useEditMode()
  // The impl publishes its real api here once its chunk mounts (and clears it
  // on unmount — e.g. sign-out, which also drops any open dialog; drafts are
  // autosaved to localStorage regardless).
  const [api, setApi] = useState<ContentEditorApi | null>(null)
  return (
    <ContentEditorContext.Provider value={api ?? inertApi}>
      {children}
      {active && (
        <Suspense fallback={null}>
          <EditorImpl onApi={setApi} />
        </Suspense>
      )}
    </ContentEditorContext.Provider>
  )
}
