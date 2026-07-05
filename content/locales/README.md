# Locale content

One directory per language, same shape inside each:

```
locales/
  en/                  # English — the source of truth, always complete
    site.yaml
    products/*.md
    guides/*.md
    pages/*.md
  ru/                  # Russian — filled in section by section
    site.yaml          # (not yet present)
    products/*.md      # (not yet present)
    guides/*.md        # (not yet present)
    pages/*.md         # (not yet present)
```

`en/` must always be complete — it's the fallback for anything missing elsewhere.
A locale directory does not need every file: `src/lib/content.ts` falls back to
`en/` per-collection and per-slug when a locale is missing a file, so the site
never breaks while a translation is in progress.

To translate a section: add the matching file under `ru/` (same filename/slug),
translate its frontmatter and body, then update `../../TRANSLATION_STATUS.md`.
`content/themes.yaml` (one level up) is shared across all locales — palette
data isn't translated.
