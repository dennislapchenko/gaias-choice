import { getPage } from '../lib/content'
import { PageHead } from '../lib/head'
import { useI18n } from '../lib/i18n'
import Markdown from '../components/Markdown'
import NotFound from './NotFound'

export default function MarkdownPage({ slug }: { slug: string }) {
  const { locale } = useI18n()
  const page = getPage(locale, slug)
  if (!page) return <NotFound />

  return (
    <article className="detail">
      <PageHead title={page.title} />
      <h1>{page.title}</h1>
      <Markdown html={page.html} />
    </article>
  )
}
