export interface NavItem {
  label: string
  path: string
}

export interface ValueItem {
  title: string
  text: string
  icon?: string // icon key rendered in the sidebar value badge (see Sidebar.tsx); falls back to a default glyph
}

/** One entry in the left-rail widget list — `type` maps to a component in Sidebar.tsx's registry. */
export interface SidebarWidget {
  type: string // mission | values | almanac | … (unknown types are skipped)
}

/**
 * A themed collection of guides ("epic"). Membership is derived from a guide's
 * FIRST tag matching `tag`; this config only supplies the display metadata
 * (thumbnail + title) and the order the collections appear in on /guides.
 */
export interface GuideEpic {
  tag: string // matches guides' first tag (e.g. "founder-guide")
  title: string // shown on the thumbnail (the word "Epic" never appears in UI)
  image?: string // thumbnail image, path under public/
  blurb?: string // one-line course intro shown under the strip when this epic is active
}

export interface SiteConfig {
  name: string
  tagline: string
  description: string
  bio: string // short personal line shown in the sidebar About panel (site.description is used on the homepage hero instead)
  url: string // current production origin, no trailing slash — reference only for now (not yet used for canonical/OG tags or sitemaps); a GitHub Pages subpath today, will become a custom domain root later
  mission: string
  heroImage?: string
  values: ValueItem[]
  sidebar?: SidebarWidget[] // left-rail composition + order; falls back to a default when absent
  epics?: GuideEpic[] // themed guide collections shown as thumbnails on /guides
  nav: NavItem[]
  footerNav?: NavItem[]
  social: { label: string; url: string }[]
  contactEmail: string
}

/** Common fields every markdown entry carries. */
export interface Entry {
  slug: string
  title: string
  html: string
}

export interface Product extends Entry {
  category: string
  rating: number
  price?: string
  affiliateUrl?: string
  image?: string
  excerpt: string
  date: string
  tags?: string[]
}

export interface Guide extends Entry {
  excerpt: string
  date: string
  image?: string
  tags?: string[]
  chapter?: number // optional course order within an epic; ascending, takes precedence over date
}

export interface Page extends Entry {
  image?: string
}

/** The set of CSS color slots a palette can override. */
export interface ThemeColors {
  sage: string // primary accent (buttons, nav, mission band)
  sageDark: string // accent hover / eyebrow text
  onAccent: string // text/icon color placed ON the accent (contrast-safe per palette)
  clay: string // warm accent (price, rating stars)
  sand: string // page background
  sand2: string // neutral surface (placeholders, nav hover)
  line: string // borders
  mint: string // pastel slot 1
  peach: string // pastel slot 2
  lilac: string // pastel slot 3
}

export interface Theme {
  tag: string // stable identifier, persisted + shown in the switcher
  label: string // human-facing name
  default?: boolean // the palette used when nothing is stored
  colors: ThemeColors
}

/** A celestial event marked on the sidebar almanac calendar. */
export interface AstroEvent {
  date: string // local YYYY-MM-DD (viewer's timezone)
  time?: string // local HH:MM of the exact event
  title: string
  body: string // celestial body (Moon, Sun, Mercury, …)
  icon: string // glyph / emoji marker
  kind?: string // phase | ingress | moon-ingress | retrograde | aspect | voc | eclipse
  blurb: string // revealed on hover/focus
}
