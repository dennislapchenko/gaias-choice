/**
 * UI chrome strings (nav, buttons, labels) — NOT page content.
 * Page content (reviews, guides, pages, site.yaml) lives in content/locales/.
 * This is the source of truth; every key here must also exist in ./ru.ts.
 */
const en = {
  'nav.primaryAriaLabel': 'Primary',
  'nav.menuAriaLabel': 'Menu',

  'footer.email': 'Email',
  'footer.disclosure':
    'Some links are affiliate links. If you buy through them we may earn a small commission at no extra cost to you. We only recommend gear we have actually used.',
  'footer.disclosureLinkText': 'Full disclosure',
  'footer.copyright': '© {{year}} {{name}}.',

  'home.eyebrow': 'Natural · Plastic-free · Fragrance-free',
  'home.browseReviews': 'Browse reviews',
  'home.readGuides': 'Read the guides',
  'home.featuredReviews': 'Featured reviews',
  'home.allReviews': 'All reviews →',
  'home.latestGuides': 'Latest guides',
  'home.allGuides': 'All guides →',

  'reviews.title': 'Reviews',
  'reviews.lead':
    'Every item here has ridden with us for real miles — tested for materials, safety, and how it holds up to life on the road with a baby.',
  'reviews.filterAriaLabel': 'Filter by category',
  'reviews.allCategory': 'All',

  'guides.title': 'Guides & checklists',
  'guides.lead':
    "Right now: our founder guides — the honest playbook we're following to build this site, in public. Reader-facing guides will replace them as we earn the experience.",
  'guides.tag': 'Guide',

  'reviewDetail.backLink': '← All reviews',
  'reviewDetail.checkPrice': 'Check current price →',

  'guideDetail.backLink': '← All guides',

  'notFound.title': 'Not found',
  'notFound.body': "This trail doesn't lead anywhere yet.",
  'notFound.backHome': 'Back home',

  'rating.ariaLabel': '{{value}} out of 5',
  'rating.title': '{{value}} / 5',

  'theme.changeTitle': 'Change color palette',
  'theme.toggleLabel': 'Palette',
  'theme.menuAriaLabel': 'Color palette',
  'theme.default': 'default',

  'lang.changeTitle': 'Change language',
  'lang.toggleLabel': 'Language',
  'lang.menuAriaLabel': 'Language',

  'astro.prevMonth': 'Previous month',
  'astro.nextMonth': 'Next month',
  'astro.noEvents': 'No marked events this month.',
  'astro.note': 'Computed from live ephemeris · shown in your local time',
  'astro.cellAriaLabel': '{{day}}: {{events}}',

  'sidebar.title': 'Celestial Almanac',
  'sidebar.intro': 'Kak budto iz ust samogo Daragana',
  'sidebar.missionLabel': 'Our mission',
  'sidebar.valuesLabel': 'What we value',
} satisfies Record<string, string>

export default en
