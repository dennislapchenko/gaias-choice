import { useState } from 'react'
import { getGuides, getSite } from '../lib/content'
import { useI18n } from '../lib/i18n'
import { withBase } from '../lib/asset'
import GuideCard from '../components/GuideCard'

export default function Guides() {
  const { locale, t } = useI18n()
  const guides = getGuides(locale)
  const site = getSite(locale)

  // Epics are themed guide collections. Config (thumbnail + title) lives in
  // site.yaml; a guide belongs to the epic whose `tag` matches its FIRST tag.
  // Only show epics that actually have guides. The first one is the default.
  const epics = (site.epics ?? []).filter((e) => guides.some((g) => g.tags?.[0] === e.tag))
  const [activeTag, setActiveTag] = useState<string | undefined>(epics[0]?.tag)

  // With epics configured, the window shows the active epic's guides; without
  // any (older config), it falls back to showing every guide.
  const activeEpic = epics.find((e) => e.tag === activeTag)
  const filtered = activeTag ? guides.filter((g) => g.tags?.[0] === activeTag) : guides
  // Chaptered guides (course order) sort ascending and come first; guides
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
        <h1>{t('guides.title')}</h1>
        <p className="lead">{t('guides.lead')}</p>
      </header>

      {epics.length > 0 && (
        <div className="epic-strip" role="tablist" aria-label={t('guides.epicsAriaLabel')}>
          {epics.map((e) => (
            <button
              key={e.tag}
              type="button"
              role="tab"
              aria-selected={e.tag === activeTag}
              className={`epic-thumb${e.tag === activeTag ? ' is-active' : ''}`}
              onClick={() => setActiveTag(e.tag)}
            >
              {e.image ? (
                <img className="epic-thumb-img" src={withBase(e.image)} alt="" loading="lazy" />
              ) : (
                <span className="epic-thumb-img placeholder" aria-hidden="true">
                  📚
                </span>
              )}
              <span className="epic-thumb-title">{e.title}</span>
            </button>
          ))}
        </div>
      )}

      {activeEpic?.blurb && <p className="epic-blurb">{activeEpic.blurb}</p>}

      <div className="grid grid-2">
        {visible.map((g) => (
          <GuideCard key={g.slug} guide={g} />
        ))}
      </div>
    </>
  )
}
