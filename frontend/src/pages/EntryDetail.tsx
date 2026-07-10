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
import StateToggle from '../components/StateToggle'
import DeleteButton from '../components/DeleteButton'
import NotFound from './NotFound'

// Shared detail layout for both a Compass chapter and a Journal entry — they
// render identically (title + date + optional hero + a page-local TOC beside
// the article). `kind` picks the getter, the back-link target/label, and the
// section tag; the chapter tag only shows for Compass.
export default function EntryDetail({ kind }: { kind: 'compass' | 'journal' }) {
  // Compass uses a splat route (slug spans the epic folder → params['*']);
  // journal is a flat `:slug`.
  const params = useParams()
  const slug = kind === 'compass' ? params['*'] : params.slug
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
        <div className="detail-nav-tags">
          <span className="tag">{tagLabel}</span>
          {chapter != null && <span className="tag">{t('compass.chapter', { n: chapter })}</span>}
          {kind === 'journal' && state === 'upcoming' && <span className="tag">{t('detail.wip')}</span>}
        </div>
        {kind === 'journal' && editModeOn && (
          <div className="detail-nav-tools">
            <StateToggle
              value={state}
              file={getJournalFile(locale, slug!)}
              onChanged={(v) => setState(v)}
            />
            <EditButton
              className="detail-edit"
              ariaLabel={t('editor.contentAria')}
              label={t('editor.edit')}
              onClick={() =>
                editor.openFile({ title: t('editor.contentTitle'), path: getJournalFile(locale, slug!) })
              }
            />
            <DeleteButton path={getJournalFile(locale, slug!)} redirectTo="/journal" />
          </div>
        )}
      </div>
      <header className="detail-header">
        <h1>{entry.title}</h1>
        <div className="detail-meta">
          <span className="muted">{entry.date}</span>
          {entry.translatedFrom && (
            <span className="muted translated-mark">
              {t(`detail.translatedFrom.${entry.translatedFrom}`)}
            </span>
          )}
        </div>
        {entry.image && (
          <img className="detail-image" src={withBase(entry.image)} alt={entry.title} />
        )}
      </header>
      <TableOfContents html={entry.html} />
      <article className="detail">
        <Markdown
          html={entry.html}
          tts={{ locale, playLabel: t('speak.play'), stopLabel: t('speak.stop') }}
        />
      </article>
    </div>
  )
}
