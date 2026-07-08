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
  type: string // about | missionValues | respected | almanac | … (unknown types are skipped)
}

/** One teacher/influence in the sidebar "Respected" panel. The substance behind
 *  each entry lives in context/ideology-context.md — keep the two in sync. */
export interface RespectedPerson {
  name: string // original spelling in every locale — people's names are never translated
  bio: string // shortest who-they-are, 1–2 sentences
  why: string // the one deep reason they're respected here
  url?: string // their website/social page — the detail card links out to it
}

/**
 * Lifecycle of a post (a review or Journal entry). Absent = active. An
 * `upcoming` post is a real content file that isn't finished yet: it drops out
 * of the main listing and shows title-only in the "in the works" rail
 * (Upcoming.tsx); flipping the frontmatter to active (or deleting the line)
 * moves it into the main spot. Compass chapters and pages ignore this field.
 */
export type PostState = 'active' | 'upcoming'

/**
 * A themed collection of Compass chapters ("epic"). Membership is derived from a
 * chapter's FIRST tag matching `tag`; this config only supplies the display
 * metadata (thumbnail + title) and the order the collections appear in on /compass.
 */
export interface GuideEpic {
  tag: string // matches a compass chapter's first tag (e.g. "founder-guide")
  title: string // shown on the thumbnail (the word "Epic" never appears in UI)
  image?: string // thumbnail image, path under public/
  blurb?: string // one-line course intro shown under the strip when this epic is active
}

/** One cryptocurrency wallet shown on the Support page. All three fields are
 *  the same in every language (tickers/chains/addresses are do-not-translate),
 *  so this lives only in en/site.yaml and ru inherits it (see getSite). */
export interface CryptoWallet {
  coin: string // ticker shown bold, e.g. "BTC"
  network: string // chain / token standard, e.g. "Tron · TRC-20" — pick the wallet's network carefully
  address: string // wallet address; a PASTE-YOUR-… placeholder until the owner fills it
}

/** Payment methods for the Support/donations page (src/pages/Support.tsx).
 *  Non-localized config — authored once in en/site.yaml, inherited by every
 *  locale. Visible copy is localized separately (UI strings + pages/support.md). */
export interface SupportConfig {
  stripe?: string // a Stripe Checkout / Payment Link URL; absent → the card button shows "coming soon"
  paypal?: string // paypal.me handle (the part after paypal.me/); absent → the PayPal card is hidden
  crypto?: CryptoWallet[] // wallets listed in order; absent/empty → the crypto card is hidden
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
  respected?: RespectedPerson[] // teachers/influences listed in the sidebar "Respected" panel
  sidebar?: SidebarWidget[] // left-rail composition + order; falls back to a default when absent
  epics?: GuideEpic[] // themed Compass collections shown as thumbnails on /compass
  ratingCriteria?: { title: string; items: string[] } // Gaia Score criteria (labels); a review's `scores` array aligns to items order
  support?: SupportConfig // payment methods for /support; non-localized, so authored in en/ only and inherited by other locales (see getSite)
  nav: NavItem[]
  footerNav?: NavItem[]
  social: { label: string; url: string }[]
  contactEmail: string
}

/**
 * Address of one editable value for the live-edit seam: the source file that
 * actually supplied it (locale fallback means a RU page often renders EN
 * values — only the content layer knows which file won) + the YAML path to
 * the value inside that file. Handed out by provenance getters in content.ts;
 * components never construct these themselves.
 */
export interface EditRef {
  file: string // repo-relative, e.g. 'content/locales/en/site.yaml'
  path: (string | number)[] // yaml Document path, e.g. ['epics', 2, 'title']
}

/** Common fields every markdown entry carries. */
export interface Entry {
  slug: string
  title: string
  html: string
  /** Source locale code when this file is a machine translation of another
   *  locale's entry (set by the editor's Translate action). Absent on
   *  hand-authored files. Rendered as a disclosure mark on the detail page. */
  translatedFrom?: string
}

export interface Product extends Entry {
  category: string
  scores: number[] // Gaia Score — one 0–5 value per site ratingCriteria item, in order
  price?: string
  affiliateUrl?: string
  image?: string
  excerpt: string
  date: string
  tags?: string[]
  state?: PostState // absent = active; upcoming = WIP, title-only in the rail
}

/**
 * A dated, markdown article — the shared shape behind both a Journal entry (a
 * human-written blog post) and a Compass chapter. Listed date-descending; both
 * render through the same detail layout (pages/EntryDetail.tsx).
 */
export interface JournalEntry extends Entry {
  excerpt: string
  date: string
  image?: string
  tags?: string[]
  state?: PostState // absent = active; upcoming = WIP, title-only in the rail (Journal only — Compass ignores it)
}

/** A Compass course chapter — a Journal-shaped article plus optional course order. */
export interface CompassEntry extends JournalEntry {
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
  // Text + card-surface slots. Omitted by light palettes (they inherit the
  // light :root defaults); dark palettes set them to flip text/cards dark.
  ink?: string // primary text
  muted?: string // secondary text
  white?: string // card / raised surface
}

export interface Theme {
  tag: string // stable identifier, persisted + shown in the switcher
  label: string // human-facing name
  default?: boolean // the light palette used when nothing is stored (system = light)
  defaultDark?: boolean // the palette used when nothing is stored AND system = dark
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
