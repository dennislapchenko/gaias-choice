import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getCompass, getSite } from '../lib/content'
import { usePageHead } from '../lib/head'
import { useI18n } from '../lib/i18n'
import { withBase } from '../lib/asset'
import CompassRow from '../components/CompassRow'

export default function Compass() {
  const { locale, t } = useI18n()
  usePageHead(t('compass.title'), t('compass.lead'))
  const entries = getCompass(locale)
  const site = getSite(locale)

  // Epics are themed course collections. Config (thumbnail + title) lives in
  // site.yaml; a chapter belongs to the epic whose `tag` matches its FIRST tag.
  // Only show epics that actually have chapters. The first one is the default.
  const epics = (site.epics ?? []).filter((e) => entries.some((g) => g.tags?.[0] === e.tag))

  // Selected course persists in the URL (?course=<tag>), mirroring the Reviews/
  // Journal filter idiom. Prerendered HTML is the default (first) tab, so the
  // param applies only after mount — a direct ?course= link hydrates cleanly.
  const [params, setParams] = useSearchParams()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const requested = mounted ? params.get('course') : null
  const activeTag = epics.some((e) => e.tag === requested) ? requested! : epics[0]?.tag
  const setActiveTag = (tag: string) =>
    setParams(tag === epics[0]?.tag ? {} : { course: tag }, { replace: true })

  // With epics configured, the window shows the active epic's chapters; without
  // any (older config), it falls back to showing every chapter.
  const activeEpic = epics.find((e) => e.tag === activeTag)
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
          {activeEpic && <h2 className="epic-title">{activeEpic.title}</h2>}
          {activeEpic?.blurb && <p className="epic-blurb">{activeEpic.blurb}</p>}

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
