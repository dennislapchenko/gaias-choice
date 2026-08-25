import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getCompass, getSite } from '../lib/content'
import { usePageHead } from '../lib/head'
import { useI18n } from '../lib/i18n'
import { withBase } from '../lib/asset'
import CompassRow from '../components/CompassRow'

export default function Compass() {
  const { locale, t } = useI18n()
  const entries = getCompass(locale)
  const site = getSite(locale)

  // Epics are themed course collections. Config (thumbnail + title) lives in
  // site.yaml; a chapter belongs to the epic whose `tag` matches its FIRST tag.
  // Only show epics that actually have chapters. The first one is the default.
  const epics = (site.epics ?? []).filter((e) => entries.some((g) => g.tags?.[0] === e.tag))

  // The selected course lives in the PATH (`/compass/<tag>`), so the prerender
  // can bake a per-course head + OG card into each course's static HTML — a
  // query param can't be prerendered and scrapers don't run JS. Resolution
  // order: path param → legacy `?course=` (back-compat for links already
  // shared) → first epic. The path param is read on the server too — only the
  // query fallback stays behind the mount gate, since it can't be prerendered.
  const { course } = useParams()
  const [params] = useSearchParams()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const requested = course ?? (mounted ? params.get('course') : null)
  const activeTag = epics.some((e) => e.tag === requested) ? requested! : epics[0]?.tag
  const navigate = useNavigate()
  const setActiveTag = (tag: string) => navigate(`/compass/${tag}`, { replace: true })

  // With epics configured, the window shows the active epic's chapters; without
  // any (older config), it falls back to showing every chapter.
  const activeEpic = epics.find((e) => e.tag === activeTag)
  // Mirrors the head the prerender bakes into /compass/<tag>.html, so a
  // client-side tab switch keeps title/description in step with the URL.
  usePageHead(
    activeEpic && course ? activeEpic.title : t('compass.title'),
    activeEpic && course ? (activeEpic.blurb ?? t('compass.lead')) : t('compass.lead'),
  )
  const filtered = activeTag ? entries.filter((g) => g.tags?.[0] === activeTag) : entries
  // Chaptered entries (course order) sort ascending and come first; entries
  // without a chapter keep the existing date-descending order (e.g. the
  // founder-guide epic, which has no chapter numbers).
  const visible = [...filtered].sort((a, b) => {
    if (a.chapter != null && b.chapter != null) return a.chapter - b.chapter
    if (a.chapter != null) return -1
    if (b.chapter != null) return 1
    return 0
  })

  return (
    <>
      <header className="page-head">
        <h1>{t('compass.title')}</h1>
        <p className="lead">{t('compass.lead')}</p>
      </header>

      {/* Provenance: Compass is the one openly computer-assisted section. */}
      <p className="compass-provenance">{t('compass.provenance')}</p>

      <div className="reviews-layout">
        <div className="reviews-main">
          {/* Title + blurb are ONE block so the sage rule groups them and marks
              them as the selected course, not more page-header prose. */}
          {activeEpic && (
            <header className="epic-head">
              <h2 className="epic-title">{activeEpic.title}</h2>
              {activeEpic.blurb && <p className="epic-blurb">{activeEpic.blurb}</p>}
            </header>
          )}

          <div className="guide-row-list">
            {visible.map((g) => (
              <CompassRow key={g.slug} entry={g} />
            ))}
          </div>
        </div>

        {epics.length > 0 && (
          <section className="epic-rail">
            <p className="side-label epic-rail-label">{t('compass.epicsAriaLabel')}</p>
            <div className="epic-rail-list" role="tablist" aria-label={t('compass.epicsAriaLabel')}>
              {epics.map((e) => (
                <button
                  key={e.tag}
                  type="button"
                  role="tab"
                  aria-selected={e.tag === activeTag}
                  className={`epic-row${e.tag === activeTag ? ' is-active' : ''}`}
                  onClick={() => setActiveTag(e.tag)}
                >
                  <span className="epic-row-thumb">
                    {e.image ? (
                      <img className="epic-row-img" src={withBase(e.image)} alt="" loading="lazy" />
                    ) : (
                      <span className="epic-row-img placeholder" aria-hidden="true">
                        📚
                      </span>
                    )}
                  </span>
                  <span className="epic-row-title">{e.title}</span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  )
}
