import { getPage } from '../lib/content'
import { useI18n } from '../lib/i18n'
import Markdown from '../components/Markdown'
import NotFound from './NotFound'

export default function MarkdownPage({ slug }: { slug: string }) {
  const { locale } = useI18n()
  const page = getPage(locale, slug)
  if (!page) return <NotFound />

  return (
    <article className="detail">
      <h1>{page.title}</h1>
      <Markdown html={page.html} />
    </article>
  )
}
