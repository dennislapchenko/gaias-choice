/** Renders pre-built (trusted, author-controlled) HTML from our markdown files. */
export default function Markdown({ html }: { html: string }) {
  return <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />
}
