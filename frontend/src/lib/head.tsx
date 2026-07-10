import { useEffect } from 'react'
import { getSite } from './content'
import { useI18n } from './i18n'

/**
 * Per-route <title> + meta description, written client-side on render.
 * Crawlers get the same values baked into each page's static HTML by the
 * prerender (entry-server.tsx derives them from the same content); this hook
 * keeps the head fresh across client-side SPA navigations — tabs, bookmarks,
 * history. Keep it dumb: DOM writes only, same composition rule as pages().
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
