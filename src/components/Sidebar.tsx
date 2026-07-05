import type { ReactNode } from 'react'
import AstroCalendar from './AstroCalendar'
import { useI18n } from '../lib/i18n'
import { getSite } from '../lib/content'
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
interface WidgetProps {
  site: SiteConfig
  t: Translate
}

// ---- Sidebar widgets. Each returns its own section(s). ----

function MissionWidget({ site, t }: WidgetProps) {
  return (
    <section className="side-card side-mission">
      <p className="side-label">{t('sidebar.missionLabel')}</p>
      <p className="side-mission-text">{site.mission}</p>
    </section>
  )
}

function ValuesWidget({ site, t }: WidgetProps) {
  return (
    <section className="side-values" aria-label={t('sidebar.valuesLabel')}>
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
    </section>
  )
}

function AlmanacWidget({ t }: WidgetProps) {
  return (
    <>
      <section className="side-card side-intro">
        <h2>{t('sidebar.title')}</h2>
        <p>{t('sidebar.intro')}</p>
      </section>
      <section className="side-card">
        <AstroCalendar />
      </section>
    </>
  )
}

// The registry: a widget `type` in site.yaml's `sidebar:` list maps to one of
// these. Add a new entry here to introduce a new left-rail widget type, then
// reference its key from site.yaml.
const WIDGETS: Record<string, (props: WidgetProps) => ReactNode> = {
  mission: MissionWidget,
  values: ValuesWidget,
  almanac: AlmanacWidget,
}

// Used when site.yaml declares no `sidebar:` list (older/partial configs).
const DEFAULT_SIDEBAR: SidebarWidget[] = [{ type: 'mission' }, { type: 'values' }, { type: 'almanac' }]

// The left rail. Its composition + order come from site.yaml's `sidebar:` list
// (content-as-data); this file only supplies the widget implementations.
export default function Sidebar() {
  const { t, locale } = useI18n()
  const site = getSite(locale)
  const widgets = site.sidebar?.length ? site.sidebar : DEFAULT_SIDEBAR

  return (
    <aside className="sidebar" aria-label="Almanac and extras">
      {widgets.map((w, i) => {
        const Widget = WIDGETS[w.type]
        return Widget ? <Widget key={`${w.type}-${i}`} site={site} t={t} /> : null
      })}
    </aside>
  )
}
