# Russian translation status

Tracks progress translating the site into Russian (`ru`). English (`en`) is the
source of truth and is always complete. Update the checkboxes as each section
gets translated — see `content/locales/README.md` for where files go and
`src/locales/ru.ts` for the UI-string dictionary.

**Delete this file once everything below is checked off** — at that point
`ru` is fully translated and this tracker has served its purpose.

## UI chrome strings (`src/locales/ru.ts`)

- [ ] `nav.*`
- [ ] `footer.*`
- [ ] `home.*`
- [ ] `reviews.*`
- [ ] `guides.*`
- [ ] `reviewDetail.*`
- [ ] `guideDetail.*`
- [ ] `notFound.*`
- [ ] `rating.*`
- [ ] `theme.*`
- [ ] `lang.*`
- [ ] `astro.*` (note: month/weekday names are handled by `Intl`, not this file — nothing to do there)
- [ ] `sidebar.*`

## Site config — `content/locales/ru/site.yaml`

- [ ] create the file (copy `content/locales/en/site.yaml` and translate: `name`, `tagline`,
      `description`, `mission`, `values[].title`/`text`, `nav[].label`, `footerNav[].label`,
      `social[].label`)

## Products — `content/locales/ru/products/*.md`

- [ ] beeswax-food-wraps.md
- [ ] castile-soap.md
- [ ] glass-baby-bottles.md
- [ ] organic-cotton-swaddle.md
- [ ] stainless-food-container.md
- [ ] wool-sleep-sack.md

## Guides — `content/locales/ru/guides/*.md`

- [ ] getting-traffic-seo-and-pinterest.md
- [ ] how-this-site-will-make-money.md
- [ ] kickstart-playbook.md
- [ ] launch-checklist.md
- [ ] writing-reviews-that-earn-trust.md

## Pages — `content/locales/ru/pages/*.md`

- [ ] about.md
- [ ] contact.md
- [ ] disclosure.md
- [ ] privacy.md
- [ ] roadmap.md

## Not translated by design

- `content/themes.yaml` — palette data, shared across all locales.
