# Gaia's Choice

A single-page app (SPA) for honest reviews of natural, plastic-free, fragrance-free
gear for RV travel with a baby.

- **Stack:** Vite + React + TypeScript, client-side routing (`react-router`).
- **Content:** authored as Markdown + YAML in [`content/`](content) and bundled at
  build time — no CMS, no backend, no database.
- **Deploy:** static build served by nginx in a container, ready for Google Cloud Run.

## Content model

Everything editable lives in `content/` — no code changes needed to publish.
Content is split by language under `content/locales/<lng>/` (English is the
source of truth; see [`content/locales/README.md`](content/locales/README.md)
and [`TRANSLATION_STATUS.md`](TRANSLATION_STATUS.md) for the in-progress
Russian translation):

| Path                              | What it is                                    |
| ---------------------------------- | --------------------------------------------- |
| `content/locales/en/site.yaml`     | Site name, tagline, mission, nav, values      |
| `content/locales/en/products/*.md` | Product reviews (yaml frontmatter + body)     |
| `content/locales/en/guides/*.md`   | Guides / checklists                           |
| `content/locales/en/pages/*.md`    | Standalone pages (About, Contact)             |
| `content/themes.yaml`              | Color palettes — shared across all locales    |

Add a review by dropping a new `.md` file in `content/locales/en/products/`.
The filename becomes the URL slug (`beeswax-food-wraps.md` →
`/reviews/beeswax-food-wraps`). Frontmatter fields are documented by example in
the existing files.

## Task runner

If you have [Task](https://taskfile.dev) installed, [`Taskfile.yml`](Taskfile.yml)
wraps every common command. All npm work runs in a `node:alpine` container with
`node_modules` in a named Docker volume, so nothing lands on your host.

```bash
task            # list all tasks
task dev        # Vite dev server on http://localhost:5173
task typecheck  # strict TypeScript check
task build      # build the SPA to dist/
task lock       # regenerate package-lock.json
task images     # optimize public/images to WebP (PNG/JPG in, WebP out)
task audit      # npm audit
task image      # build the production nginx image
task run        # build + run the image on http://localhost:8080
task verify     # audit + typecheck + image build
task deploy     # gcloud run deploy --source . (override REGION=/SERVICE=)
task clean      # drop dist/, the deps volume, task cache, and the image
```

The raw commands below do the same thing without Task.

## Local development

All npm work is intended to run inside a container so nothing touches your host.

### Isolated build & run (recommended)

```bash
# Build the production image (installs deps + builds inside node:alpine)
docker build -t gaias-choice .

# Run it locally; Cloud Run uses $PORT, default 8080
docker run --rm -p 8080:8080 gaias-choice
# open http://localhost:8080
```

### If you do want a host dev server

```bash
npm ci --ignore-scripts   # .npmrc also enforces ignore-scripts
npm run dev               # http://localhost:5173
npm run build             # outputs to dist/
```

## Supply-chain notes

- Only 5 runtime deps: `react`, `react-dom`, `react-router-dom`, `marked`, `yaml`.
- [`.npmrc`](.npmrc) sets `ignore-scripts=true` — package lifecycle scripts never
  run, closing the most common npm RCE vector.
- `package-lock.json` pins the full tree. Run `npm audit` to check for advisories.

## Deploy to Google Cloud Run

The `Dockerfile` is Cloud Run–ready: nginx listens on `$PORT` (default 8080) and
serves the SPA with an `index.html` fallback for client-side routes.

### One-shot deploy from source

```bash
gcloud run deploy gaias-choice \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --port 8080
```

Cloud Run builds the `Dockerfile` with Cloud Build and rolls out the revision.

### Or build/push explicitly

```bash
REGION=europe-west1
PROJECT=$(gcloud config get-value project)
REPO=europe-west1-docker.pkg.dev/$PROJECT/apps/gaias-choice

# One-time: create an Artifact Registry repo named "apps"
gcloud artifacts repositories create apps \
  --repository-format=docker --location=$REGION 2>/dev/null || true

gcloud builds submit --tag $REPO
gcloud run deploy gaias-choice \
  --image $REPO --region $REGION --allow-unauthenticated --port 8080
```

## Map your domain

Once you have a domain, map it to the service (verify ownership first in
[Search Console](https://search.google.com/search-console)):

```bash
gcloud beta run domain-mappings create \
  --service gaias-choice \
  --domain www.your-domain.com \
  --region europe-west1
```

Cloud Run prints the DNS records (usually a `CNAME` for a subdomain, or `A`/`AAAA`
for an apex domain). Add them at your registrar. TLS certificates are provisioned
automatically once DNS resolves.

> For an apex + `www` setup, or higher traffic, front the service with a Google
> Cloud external HTTPS Load Balancer and a serverless NEG instead of a direct
> domain mapping.
