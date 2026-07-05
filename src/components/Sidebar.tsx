import AstroCalendar from './AstroCalendar'
import { useI18n } from '../lib/i18n'

// The left rail: home for "funky" widgets. Add more <section className="side-card">
// blocks here over time.
export default function Sidebar() {
  const { t } = useI18n()
  return (
    <aside className="sidebar" aria-label="Almanac and extras">
      <section className="side-card side-intro">
        <h2>{t('sidebar.title')}</h2>
        <p>{t('sidebar.intro')}</p>
      </section>

      <section className="side-card">
        <AstroCalendar />
      </section>
    </aside>
  )
}
