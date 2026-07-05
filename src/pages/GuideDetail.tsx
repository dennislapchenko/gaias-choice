import { Link, useParams } from 'react-router-dom'
import { getGuide } from '../lib/content'
import { useI18n } from '../lib/i18n'
import { withBase } from '../lib/asset'
import Markdown from '../components/Markdown'
import TableOfContents from '../components/TableOfContents'
import NotFound from './NotFound'

export default function GuideDetail() {
  const { slug } = useParams()
  const { locale, t } = useI18n()
  const guide = slug ? getGuide(locale, slug) : undefined
  if (!guide) return <NotFound />

  return (
    <div className="detail-layout">
      <article className="detail">
        <Link to="/guides" className="back-link">
          {t('guideDetail.backLink')}
        </Link>
        <span className="tag">{t('guides.tag')}</span>
        {guide.chapter != null && (
          <span className="tag">{t('guides.chapter', { n: guide.chapter })}</span>
        )}
        <h1>{guide.title}</h1>
        <div className="detail-meta">
          <span className="muted">{guide.date}</span>
        </div>
        {guide.image && (
          <img className="detail-image" src={withBase(guide.image)} alt={guide.title} />
        )}
        <Markdown html={guide.html} />
      </article>
      <TableOfContents html={guide.html} />
    </div>
  )
}
