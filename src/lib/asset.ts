// Resolve root-absolute asset paths against Vite's base URL so images work
// whether the site is served at "/" (local dev, Cloud Run/nginx) or under a
// subpath like "/gaias-choice/" (GitHub Pages project page). BASE_URL always
// ends with a trailing slash.
const BASE = import.meta.env.BASE_URL

/** `/images/hero.webp` -> `${base}images/hero.webp`. Leaves non-root paths as-is. */
export function withBase(path: string | undefined): string | undefined {
  if (!path || !path.startsWith('/')) return path
  return BASE + path.slice(1)
}

/** Rewrite root-absolute /images/... refs inside rendered markdown HTML. */
export function withBaseHtml(html: string): string {
  return html.replaceAll('="/images/', `="${BASE}images/`)
}
