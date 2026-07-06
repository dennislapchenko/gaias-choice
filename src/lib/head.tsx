import { useEffect } from 'react'
import { getSite } from './content'
import { useI18n } from './i18n'

/**
 * Per-route <title> + meta description, written client-side on render.
 * Interim until build-time prerendering bakes per-route heads into static
 * HTML (context/seo/seo-paths.md) — crawlers still see index.html's head;
 * this is for tabs, bookmarks, and history. The prerender step will derive
 * the same values straight from content, so keep this dumb: DOM writes only.
 *
 * No `title` → the home form "<name> — <tagline>"; otherwise "<title> — <name>".
 * No `description` → the site description.
 */
export function usePageHead(title?: string, description?: string) {
  const { locale } = useI18n()
  const site = getSite(locale)
  const fullTitle = title ? `${title} — ${site.name}` : `${site.name} — ${site.tagline}`
  const desc = description ?? site.description
  useEffect(() => {
    document.title = fullTitle
    document.querySelector('meta[name="description"]')?.setAttribute('content', desc)
  }, [fullTitle, desc])
}

/**
 * usePageHead as a component, for pages whose data can be missing (they
 * early-return <NotFound /> before any hook could run unconditionally).
 * Render it only in the found branch; NotFound sets its own head.
 */
export function PageHead({ title, description }: { title?: string; description?: string }) {
  usePageHead(title, description)
  return null
}
