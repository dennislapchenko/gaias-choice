# Locale content

One directory per language, same shape inside each:

```
locales/
  en/                  # English — the source of truth, always complete
    site.yaml
    products/*.md
    guides/*.md
    pages/*.md
  ru/                  # Russian — currently complete
    site.yaml
    products/*.md
    guides/*.md
    pages/*.md
```

`en/` must always be complete — it's the fallback for anything missing elsewhere.
A locale directory does not need every file: `src/lib/content.ts` falls back to
`en/` per-collection and per-slug when a locale is missing a file, so the site
never breaks while a translation is in progress.

To translate a section: add the matching file under the target locale (same
filename/slug), then translate its frontmatter and body. `content/themes.yaml`
(one level up) is shared across all locales — palette data isn't translated.

## Terms that stay in English (do NOT translate/calque)

Translate the *prose*, but keep recognizable proper nouns and terms-of-art in
English rather than calquing them into a native phrase. The rule of thumb: if
it's a name, a brand, a platform, or a piece of product/tech jargon that a
reader would recognize in English, leave it in English. A native calque like
`Дорожная карта` for **Roadmap** is wrong — it hides the term.

Keep in English (non-exhaustive):

- **Brand:** `Gaia's Choice` (it's the logo/wordmark — never translate).
- **Site sections / nav that are terms-of-art:** `Roadmap` (a startup/
  building-in-public term — stays English in nav, footer, page `title`, and
  in-prose references to that page). Ordinary nav words with plain native
  equivalents are still translated (Home→Главная, Reviews→Обзоры,
  Guides→Гайды, About→О нас, Contact→Контакты).
- **Palette names:** Meadow, Bubblegum, Citrus, Periwinkle, Lagoon, Sunset,
  Grape (invented names in `themes.yaml`; not localized anyway).
- **Platforms / companies / products:** Pinterest, Instagram, Amazon, Amazon
  Associates, Google, Google Cloud Run, Search Console, Bing Webmaster Tools,
  Mediavine, Raptive, AdSense, Awin, ShareASale, impact.com, AvantLink,
  Listmonk, Kit, MailerLite, Plausible, GoatCounter, umami, ConvertKit.
- **Tech / standards / code:** SEO, SPA, HTML, Open Graph, Rich Pins,
  `sitemap.xml`, `localStorage`, cookie, WebP, PDF, FTC, GOTS, OEKO-TEX, Vite,
  React, and any field/file name (`site.yaml`, `affiliateUrl`, `/go/<slug>`…).

Judgment call, not a blocklist: when a term has a genuinely common Russian
loanword that keeps the original recognizable (e.g. `плейбук` for *playbook*),
that's fine — the thing to avoid is a full native calque that erases the
English term. When unsure, keep the English term.
