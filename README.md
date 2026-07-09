# Gaia's Choice

Natural, conscious living on the road with a baby — honest reviews of
plastic-free, fragrance-free gear, free courses on the skills we practice (the
Compass), and a handwritten travel Journal. Everything lived first; built in
public by a real camper family.

- **Stack:** Vite + React 18 + TypeScript SPA in [`frontend/`](frontend). All
  content is Markdown + YAML in [`content/`](content) (repo root, shared),
  bundled at build time — no CMS. Adding a review is dropping a `.md` file; the
  filename becomes the URL slug. An **optional** Go API sidecar
  ([`backend/`](backend)) adds progressive-enhancement features; the static
  site works identically without it.
- **Tooling:** [Task](https://taskfile.dev) wraps everything (`task` lists all
  commands). All npm work runs inside a `node:22-alpine` container with
  `node_modules` in a Docker volume — nothing touches the host, and
  [`.npmrc`](frontend/.npmrc) sets `ignore-scripts=true`. Six runtime dependencies.
- **Deploy:** GitHub Pages on every push to `main`
  ([`deploy-pages.yml`](.github/workflows/deploy-pages.yml)); the
  [`frontend/Dockerfile`](frontend/Dockerfile) (nginx, `$PORT`-aware) keeps
  Cloud Run as an alternate target.

```bash
task dev        # FE (Vite :5173) + optional Go backend (:8787) together
task typecheck  # strict tsc (vite build alone does NOT type-check)
task build      # build the SPA to frontend/dist/
task run        # production nginx image on :8080
task be:verify  # backend gate: OpenAPI spec-drift check + vet + test + image build
```

Architecture, content model, i18n, theming, and all working conventions are
documented in [`CLAUDE.md`](CLAUDE.md). Per-locale content layout and the
do-not-translate glossary: [`content/locales/README.md`](content/locales/README.md).
