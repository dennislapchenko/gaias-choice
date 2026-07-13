# Review slugs & two-locale sanity — options

The question: reviews must stay nicely mirrored en↔ru, any editor may write in
either language (implemented), but slugs are one shared string per review —
does an English slug hurt RU SEO, and what's the sane long-term model?

## Current state (verified in repo)

- **Slug = filename, shared by both locales.** `/reviews/<slug>` (RU) and
  `/en/reviews/<slug>` are the same file name in two trees; the locale lives in
  the URL *prefix*, never in the slug.
- **The SEO plumbing already exists and keys on the shared slug**
  (`frontend/scripts/prerender.mjs headFor`): per-page `canonical`, per-locale
  `<html lang>` + `og:locale`, and `hreflang` ru/en/**x-default→RU** pairs.
  RU is the unprefixed default tree *and* x-default — RU is already the
  SEO-priority locale.
- **Upcoming posts are prerendered `noindex`** (`entry-server.tsx:97`) — the 15
  current stubs carry **zero SEO equity**; renaming any of them is free.
- **The 5 active reviews are AI placeholders slated for deletion**
  (CLAUDE.md) — so *no current slug has any equity at all*. Whatever
  convention is picked now costs nothing to apply.
- Current mix: ~8 transliterated-RU slugs (`butylka-vody-layfstro`,
  `grafin-iz-ikei`, …) and ~7 English slugs (`manduca-xt-baby-carrier`,
  `dreamegg-white-noise-machine`, …) — the portal's ＋ button transliterates
  whatever title the creator typed.

## The SEO reality on slug language

- Slug keywords are a **minor** ranking signal for Google (officially "a very
  small factor"); titles, H1/H2s, body text, and correct hreflang dominate.
  All of those are per-locale here and in the right language already.
- Yandex (the engine that matters for the RU audience) is comfortable with
  transliterated slugs — they're the RU-web convention — and gives them a
  slight keyword nod; but the same "titles ≫ slugs" hierarchy applies.
- Cyrillic slugs work in both engines but percent-encode into unreadable
  URLs when copied/shared — rejected outright.
- **An English slug does not "kill" RU SEO.** With RU titles, RU headings, RU
  body, `lang=ru`, and hreflang in place, the slug's language is noise. The
  real sanity problem in the repo is the *inconsistency* (mixed translit/EN),
  not the language choice.

## Paths

### 1. Status quo — creator's language decides the slug
No change; whoever creates the draft names the file. **Cost:** the mix
becomes permanent; URLs look accidental; two editors produce two styles
forever. No SEO harm, but no coherence either.

### 2. One convention: Latin, brand + product-type in English  ← recommended
`manduca-xt-baby-carrier`, `ikea-carafe`, `lifestraw-gravity-filter`.
Editorial rule only — **zero code** (rename the ~8 translit stubs now while
everything is noindexed/placeholder). Brand names are already Latin and
do-not-translate; the EN noun makes URLs legible to both audiences and to
future partners/tools. RU SEO unaffected (see above). Rule lives in
`content-editing.md`; the portal keeps transliterating typed titles, editor
renames to convention before first Active flip (or we note it as a
create-time habit).

### 3. One convention: transliterated Russian
`podushka-dlya-kormleniya-mozhno` everywhere. Symmetric to #2, slight Yandex
nod, but mixes awkwardly with Latin brand names (`dreamegg-belyj-shum`?) and
is opaque to EN readers. Only worth it if Yandex is declared the single
target engine.

### 4. Per-locale slugs (localized slug in frontmatter + shared translation key)
The "real i18n CMS" answer: `/reviews/подушка-можно` ↔ `/en/reviews/mozhno-pillow`.
**Rejected as over-engineering at this scale:** breaks the "filename is the
slug" invariant, needs slug resolution + sibling mapping in `content.ts`,
hreflang pairing, the language switcher, portal seeding, and redirect
handling — all to chase the weakest ranking signal on a site with <25
reviews. Revisit only if analytics someday shows RU search underperforming
with everything else equal.

## Cross-cutting: what "mirrored sanity" actually rests on

Slugs are the smallest piece. The load-bearing parts, all already in place:
one shared slug = one review identity across locales; locale lives in the URL
prefix; RU is the human source (EN machine-translated on Active flip, marked
`translatedFrom`); hreflang pairs tell engines the two pages are one document;
per-locale titles/headings carry the keyword weight. The only *maintenance*
rule to keep: never let the two trees disagree on a slug (rename = rename both
files in one commit; the sitemap/hreflang pairing does the rest).

## Recommendation

**Path 2.** One line of editorial convention, one free batch rename now, no
code, no invariant broken. Document the rule in `content-editing.md` and move
on — slugs were never where RU SEO lives.
