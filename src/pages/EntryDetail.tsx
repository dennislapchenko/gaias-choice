import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getCompassEntry, getJournalEntry, getJournalFile } from '../lib/content'
import type { CompassEntry, PostState } from '../lib/types'
import { PageHead } from '../lib/head'
import { useI18n } from '../lib/i18n'
import { withBase } from '../lib/asset'
import { useContentEditor } from '../lib/contentEditor'
import { useEditMode } from '../lib/editMode'
import Markdown from '../components/Markdown'
import TableOfContents from '../components/TableOfContents'
import EditButton from '../components/EditButton'
import NotFound from './NotFound'

// Shared detail layout for both a Compass chapter and a Journal entry — they
// render identically (title + date + optional hero + a page-local TOC beside
// the article). `kind` picks the getter, the back-link target/label, and the
// section tag; the chapter tag only shows for Compass.
export default function EntryDetail({ kind }: { kind: 'compass' | 'journal' }) {
  const { slug } = useParams()
  const { locale, t } = useI18n()
  // A JournalEntry is structurally a CompassEntry (chapter is optional), so both
  // getters' results share this type; `chapter` is only surfaced for compass.
  const entry: CompassEntry | undefined = slug
    ? kind === 'compass'
      ? getCompassEntry(locale, slug)
      : getJournalEntry(locale, slug)
    : undefined
  const editor = useContentEditor()
  const { active: editModeOn } = useEditMode()
  // Local override so flipping state feels immediate (optimistic UI) — the
  // static content.ts data itself only catches up once the save's git commit
  // deploys, ~2 min later (see contentEditor.tsx). Compass ignores `state`
  // entirely, so this is only ever exercised for kind === 'journal'.
  const [state, setState] = useState<PostState | undefined>(entry?.state)
  useEffect(() => setState(entry?.state), [entry])
  if (!entry) return <NotFound />

  const backTo = kind === 'compass' ? '/compass' : '/journal'
  const backLabel = kind === 'compass' ? t('compassDetail.backLink') : t('journalDetail.backLink')
  const tagLabel = kind === 'compass' ? t('compass.tag') : t('journal.tag')
  const chapter = kind === 'compass' ? entry.chapter : undefined

  return (
    <div className="detail-layout">
      <PageHead title={entry.title} description={entry.excerpt} />
      <div className="detail-nav">
        <Link to={backTo} className="back-link">
          {backLabel}
        </Link>
        <span className="tag">{tagLabel}</span>
        {chapter != null && <span className="tag">{t('compass.chapter', { n: chapter })}</span>}
        {kind === 'journal' && state === 'upcoming' && (
          <span className="tag">
            {t('detail.wip')}
            {editModeOn && (
              <EditButton
                className="wip-edit"
                ariaLabel={t('editor.stateAria')}
                onClick={() =>
                  editor.openField({
                    title: t('editor.stateTitle'),
                    ref: { file: getJournalFile(locale, slug!), path: ['state'] },
                    onSaved: (v) => setState(v as PostState),
                  })
                }
              />
            )}
          </span>
        )}
      </div>
      <header className="detail-header">
        <h1>{entry.title}</h1>
        <div className="detail-meta">
          <span className="muted">{entry.date}</span>
        </div>
        {entry.image && (
          <img className="detail-image" src={withBase(entry.image)} alt={entry.title} />
        )}
      </header>
      <TableOfContents html={entry.html} />
      <article className="detail">
        <Markdown html={entry.html} />
      </article>
    </div>
  )
}
