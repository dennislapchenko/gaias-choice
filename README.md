# Gaia's Choice

Honest reviews of natural, plastic-free, fragrance-free gear for family travel
with a baby — plus free courses (the Compass) and a travel journal. Built in
public by a real camper family.

- **Stack:** Vite + React 18 + TypeScript SPA. All content is Markdown + YAML
  in [`content/`](content), bundled at build time — no CMS, no backend, no
  database. Adding a review is dropping a `.md` file; the filename becomes the
  URL slug.
- **Tooling:** [Task](https://taskfile.dev) wraps everything (`task` lists all
  commands). All npm work runs inside a `node:22-alpine` container with
  `node_modules` in a Docker volume — nothing touches the host, and
  [`.npmrc`](.npmrc) sets `ignore-scripts=true`. Six runtime dependencies.
- **Deploy:** GitHub Pages on every push to `main`
  ([`deploy-pages.yml`](.github/workflows/deploy-pages.yml)); the
  [`Dockerfile`](Dockerfile) (nginx, `$PORT`-aware) keeps Cloud Run as an
  alternate target.

```bash
task dev        # dev server on :5173
task typecheck  # strict tsc (vite build alone does NOT type-check)
task build      # build the SPA to dist/
task run        # production nginx image on :8080
```

Architecture, content model, i18n, theming, and all working conventions are
documented in [`CLAUDE.md`](CLAUDE.md). Per-locale content layout and the
do-not-translate glossary: [`content/locales/README.md`](content/locales/README.md).
