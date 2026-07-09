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
 */
export function withBaseHtml(html: string): string {
  return html.replace(/(href|src)="\/(?!\/)/g, `$1="${BASE}`)
}
