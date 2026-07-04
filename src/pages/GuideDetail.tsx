import { Link, useParams } from 'react-router-dom'
import { getGuide } from '../lib/content'
import { withBase } from '../lib/asset'
import Markdown from '../components/Markdown'
import NotFound from './NotFound'

export default function GuideDetail() {
  const { slug } = useParams()
  const guide = slug ? getGuide(slug) : undefined
  if (!guide) return <NotFound />

  return (
    <article className="detail">
      <Link to="/guides" className="back-link">
        ← All guides
      </Link>
      <span className="tag">Guide</span>
      <h1>{guide.title}</h1>
      <div className="detail-meta">
        <span className="muted">{guide.date}</span>
      </div>
      {guide.image && <img className="detail-image" src={withBase(guide.image)} alt={guide.title} />}
      <Markdown html={guide.html} />
    </article>
  )
}
