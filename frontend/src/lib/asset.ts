// Resolve root-absolute asset paths against Vite's base URL so images work
// whether the site is served at "/" (local dev, nginx image) or under a
// subpath like "/gaias-choice/" (GitHub Pages project page). BASE_URL always
// ends with a trailing slash.
const BASE = import.meta.env.BASE_URL

/** `/images/hero.webp` -> `${base}images/hero.webp`. Leaves non-root paths as-is. */
export function withBase(path: string | undefined): string | undefined {
  if (!path || !path.startsWith('/')) return path
  return BASE + path.slice(1)
}

/**
 * Rewrite root-absolute `href`/`src` refs (images, and internal links like
 * `/compass/<slug>`) inside rendered markdown HTML so they resolve under the
 * GitHub Pages subpath instead of the domain root. Markdown links are plain
 * `<a>` tags (not router `<Link>`s), so without this a click is a real
 * browser navigation straight to `href` — missing the base prefix sends it
 * to the wrong origin-relative URL entirely. Protocol-relative (`//host/…`)
 * and absolute (`https://…`) URLs are left untouched via the `(?!\/)` guard.
 *
 * `locale: 'en'` additionally moves internal page links into the `/en` URL
 * tree (locale-in-URL routing — see lib/i18n.tsx). Asset refs stay shared:
 * `src=` and `/images/…` hrefs never get the prefix.
 */
export function withBaseHtml(html: string, locale?: string): string {
  const based = html.replace(/(href|src)="\/(?!\/)/g, `$1="${BASE}`)
  if (locale !== 'en') return based
  return based
    .replace(new RegExp(`href="${BASE}"`, 'g'), `href="${BASE}en"`)
    .replace(new RegExp(`href="${BASE}(?!/)(?!en/|en")(?!images/)(?!")`, 'g'), `href="${BASE}en/`)
}
