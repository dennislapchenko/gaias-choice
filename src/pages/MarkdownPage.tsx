import { getPage } from '../lib/content'
import Markdown from '../components/Markdown'
import NotFound from './NotFound'

export default function MarkdownPage({ slug }: { slug: string }) {
  const page = getPage(slug)
  if (!page) return <NotFound />

  return (
    <article className="detail">
      <h1>{page.title}</h1>
      <Markdown html={page.html} />
    </article>
  )
}
