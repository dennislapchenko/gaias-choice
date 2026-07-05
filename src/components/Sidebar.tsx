import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import AstroCalendar from './AstroCalendar'
import { useI18n, type Locale } from '../lib/i18n'
import { getPage, getSite } from '../lib/content'
import { withBase } from '../lib/asset'
import type { SidebarWidget, SiteConfig } from '../lib/types'

// Inline value-badge icons, keyed by the `icon:` field on each value in
// site.yaml. Stroke-based, inherit currentColor. Add a new key here to offer a
// new icon; choosing among existing ones stays a pure content edit.
const VALUE_ICONS: Record<string, ReactNode> = {
  honesty: (
    <>
      <path d="M12 2.5l7.5 3.2v5.3c0 4.8-3.2 8-7.5 9.5-4.3-1.5-7.5-4.7-7.5-9.5V5.7L12 2.5z" />
      <path d="M8.5 11.8l2.4 2.4 4.6-4.8" />
    </>
  ),
  natural: (
    <>
      <path d="M4.5 19.5C3.5 11 9 4.5 19.5 5c.5 10.5-6 16-15 15z" />
      <path d="M5 19c3.5-4.5 7-7 11-8.6" />
    </>
  ),
  less: <path d="M12 3c.4 4.7 1.3 5.6 6 6-4.7.4-5.6 1.3-6 6-.4-4.7-1.3-5.6-6-6 4.7-.4 5.6-1.3 6-6z" />,
  mindful: (
    <path d="M12 20.3l-1.1-1C6.1 15 3 12.1 3 8.6 3 6 5 4 7.5 4c1.5 0 2.9.7 3.8 1.8L12 7l.7-1.2C13.6 4.7 15 4 16.5 4 19 4 21 6 21 8.6c0 3.5-3.1 6.4-7.9 10.7l-1.1 1z" />
  ),
}

function ValueIcon({ name }: { name?: string }) {
  const glyph = (name && VALUE_ICONS[name]) || VALUE_ICONS.less
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {glyph}
    </svg>
  )
}

type Translate = (key: string) => string
interface BodyProps {
  site: SiteConfig
  t: Translate
  locale: Locale
}

// ---- Panel bodies. Each renders the content revealed when its panel opens. ----

function AboutBody({ site, t, locale }: BodyProps) {
  // Pull the linked page's image straight from its frontmatter, so the sidebar
  // preview stays in sync with the page it opens.
  const page = getPage(locale, 'about')
  const image = withBase(page?.image)
  return (
    <div className="side-about">
      {image && <img className="side-about-img" src={image} alt={page?.title ?? ''} loading="lazy" />}
      <p className="side-about-text">{site.bio}</p>
      <Link className="side-about-link" to="/about">
        {t('sidebar.aboutMore')}
      </Link>
    </div>
  )
}

function MissionValuesBody({ site, t }: BodyProps) {
  return (
    <>
      <div className="side-mission">
        <p className="side-label">{t('sidebar.missionLabel')}</p>
        <p className="side-mission-text">{site.mission}</p>
      </div>
      <div className="side-values" aria-label={t('sidebar.valuesLabel')}>
        <p className="side-label">{t('sidebar.valuesLabel')}</p>
        <div className="value-badge-list">
          {site.values.map((v) => (
            <div key={v.title} className="value-badge">
              <span className="value-badge-icon">
                <ValueIcon name={v.icon} />
              </span>
              <div className="value-badge-body">
                <h3>{v.title}</h3>
                <p>{v.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function AlmanacBody({ t }: BodyProps) {
  return (
    <>
      <p className="side-intro-text">{t('sidebar.intro')}</p>
      <AstroCalendar />
    </>
  )
}

interface PanelDef {
  label: (t: Translate) => string
  Body: (props: BodyProps) => ReactNode
  // Whether the panel starts open on desktop. On mobile every panel starts
  // closed (the toggles act like tabs — see SidebarMobile).
  desktopOpen: boolean
}

// The registry: a widget `type` in site.yaml's `sidebar:` list maps to a panel.
// Add a new entry here to introduce a new left-rail panel, then reference its
// key from site.yaml.
const PANELS: Record<string, PanelDef> = {
  about: { label: (t) => t('sidebar.aboutLabel'), Body: AboutBody, desktopOpen: true },
  missionValues: { label: (t) => t('sidebar.missionValuesLabel'), Body: MissionValuesBody, desktopOpen: false },
  almanac: { label: (t) => t('sidebar.title'), Body: AlmanacBody, desktopOpen: true },
}

// Used when site.yaml declares no `sidebar:` list (older/partial configs).
const DEFAULT_SIDEBAR: SidebarWidget[] = [{ type: 'about' }, { type: 'missionValues' }, { type: 'almanac' }]

// True below the point where the two-column layout collapses (kept in sync with
// the `max-width: 900px` sidebar rule in styles.css).
function useIsNarrow() {
  const query = '(max-width: 900px)'
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setNarrow(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return narrow
}

// A flat rectangular toggle over collapsible content (desktop left rail).
function CollapsiblePanel({
  label,
  defaultOpen,
  children,
}: {
  label: string
  defaultOpen: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className={`side-panel${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="side-panel-toggle"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{label}</span>
        <span className="side-chevron" aria-hidden="true" />
      </button>
      {open && <div className="side-panel-body">{children}</div>}
    </section>
  )
}

// On phones the rail moves above the content (see styles.css) and behaves like a
// row of tabs in the freed header space: a row of rectangular toggles, at most
// one open at a time, its body revealed full-width below.
function SidebarMobile({
  widgets,
  site,
  t,
  locale,
}: {
  widgets: SidebarWidget[]
  site: SiteConfig
  t: Translate
  locale: Locale
}) {
  const [openType, setOpenType] = useState<string | null>(null)
  const active = openType ? PANELS[openType] : undefined
  const ActiveBody = active?.Body

  return (
    <aside className="sidebar sidebar-mobile" aria-label="Almanac and extras">
      <div className="side-tabs">
        {widgets.map((w) => {
          const isOpen = openType === w.type
          return (
            <button
              key={w.type}
              type="button"
              className={`side-tab${isOpen ? ' is-open' : ''}`}
              aria-expanded={isOpen}
              onClick={() => setOpenType(isOpen ? null : w.type)}
            >
              <span>{PANELS[w.type].label(t)}</span>
              <span className="side-chevron" aria-hidden="true" />
            </button>
          )
        })}
      </div>
      {ActiveBody && (
        <div className="side-panel-body side-tab-body">
          <ActiveBody site={site} t={t} locale={locale} />
        </div>
      )}
    </aside>
  )
}

// The left rail. Its composition + order come from site.yaml's `sidebar:` list
// (content-as-data); this file only supplies the panel implementations.
export default function Sidebar() {
  const { t, locale } = useI18n()
  const site = getSite(locale)
  const narrow = useIsNarrow()
  const widgets = (site.sidebar?.length ? site.sidebar : DEFAULT_SIDEBAR).filter(
    (w) => PANELS[w.type],
  )

  if (narrow) return <SidebarMobile widgets={widgets} site={site} t={t} locale={locale} />

  return (
    <aside className="sidebar" aria-label="Almanac and extras">
      {widgets.map((w, i) => (
        <CollapsiblePanel key={`${w.type}-${i}`} label={PANELS[w.type].label(t)} defaultOpen={PANELS[w.type].desktopOpen}>
          {PANELS[w.type].Body({ site, t, locale })}
        </CollapsiblePanel>
      ))}
    </aside>
  )
}
