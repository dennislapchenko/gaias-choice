import { getGuides } from '../lib/content'
import { useI18n } from '../lib/i18n'
import GuideCard from '../components/GuideCard'

export default function Guides() {
  const { locale, t } = useI18n()
  const guides = getGuides(locale)

  return (
    <>
      <header className="page-head">
        <h1>{t('guides.title')}</h1>
        <p className="lead">{t('guides.lead')}</p>
      </header>
      <div className="grid grid-2">
        {guides.map((g) => (
          <GuideCard key={g.slug} guide={g} />
        ))}
      </div>
    </>
  )
}
