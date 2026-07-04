import { parse as parseYaml } from 'yaml'
import { marked } from 'marked'
import { withBaseHtml } from './asset'
import siteRaw from '../../content/site.yaml?raw'
import themesRaw from '../../content/themes.yaml?raw'
import type { Guide, Page, Product, SiteConfig, Theme } from './types'

marked.setOptions({ gfm: true, breaks: false })

export const site = parseYaml(siteRaw) as SiteConfig

export const themes = parseYaml(themesRaw) as Theme[]
export const defaultTheme = themes.find((t) => t.default) ?? themes[0]

/** Split `---`-delimited yaml frontmatter from the markdown body. */
function parseFrontmatter(raw: string): { data: Record<string, unknown>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw)
  if (!match) return { data: {}, body: raw }
  return { data: (parseYaml(match[1]) as Record<string, unknown>) ?? {}, body: match[2] }
}

function slugFromPath(path: string): string {
  return path.split('/').pop()!.replace(/\.md$/, '')
}

function loadCollection<T>(modules: Record<string, string>): T[] {
  return Object.entries(modules).map(([path, raw]) => {
    const { data, body } = parseFrontmatter(raw)
    return {
      slug: slugFromPath(path),
      ...data,
      html: withBaseHtml(marked.parse(body) as string),
    } as T
  })
}

const byDateDesc = (a: { date?: string }, b: { date?: string }) =>
  (b.date ?? '').localeCompare(a.date ?? '')

// Eager glob = content is bundled at build time; no runtime fetch, no server needed.
const productModules = import.meta.glob('../../content/products/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const guideModules = import.meta.glob('../../content/guides/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const pageModules = import.meta.glob('../../content/pages/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

export const products = loadCollection<Product>(productModules).sort(byDateDesc)
export const guides = loadCollection<Guide>(guideModules).sort(byDateDesc)
export const pages = loadCollection<Page>(pageModules)

export const getProduct = (slug: string) => products.find((p) => p.slug === slug)
export const getGuide = (slug: string) => guides.find((g) => g.slug === slug)
export const getPage = (slug: string) => pages.find((p) => p.slug === slug)
