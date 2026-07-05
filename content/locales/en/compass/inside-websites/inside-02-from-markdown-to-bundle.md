---
title: "From Markdown to Bundle: How Content Becomes a Website"
excerpt: The build layer — glob imports, frontmatter, the markdown renderer, the trust boundary, and why a filename is a URL.
image: /images/guide-inside-02-from-markdown-to-bundle.svg
date: 2026-07-05
chapter: 2
tags: [inside-websites, build]
---

> **Chapter 2 of 5 · The Path** — [← Chapter 1: The Whole Machine](/compass/inside-01-the-whole-machine) · [Chapter 3: The Living Page →](/compass/inside-03-the-living-page)
> *You can already:* run this site locally and change its content without touching code.
> *This chapter adds:* the exact pipeline that turns a markdown file into typed data inside the bundle — and the ability to trace any sentence on this site back to its file.

> **Engine-room course.** Written to explain this very site's code to our own
> team — every file path named here is real; the site you're reading is the
> lab.

## There is no database

Ask where a review "lives" on a normal website and the answer is a database
row. Ask it here and the answer is a file you can open:
`content/locales/en/products/organic-cotton-swaddle.md`. At the top, between
two `---` lines, a small block of YAML — title, rating, price, date. Below
it, prose.

Remember the two-phase machine from chapter 1 — before reading on, try to
recall *which phase* must be responsible for turning that file into a page,
and why it can't be the other one. The answer: build time, necessarily.
At browse time there is no server to query and no filesystem to read — the
browser only has the bundle. So every piece of content, in every language,
must already be *inside* the bundle before the first visitor arrives. This
chapter is the story of how it gets there. One file in `src/` does almost
all of it: `src/lib/content.ts`. Keep it open as you read; it's ~300 lines
and after this chapter you will be able to read all of them.

## The glob vacuum

The pipeline starts with four lines that look like magic and are actually
the whole trick:

```ts
import.meta.glob('../../content/locales/*/products/*.md', { query: '?raw', eager: true })
```

`import.meta.glob` is a Vite build-time feature. At build time, Vite finds
**every file matching the pattern** — every product, in every locale — and
imports each one *as a raw string*, straight into the JavaScript bundle.
There is no `fs.readFile` anywhere, because by browse time there is no
filesystem; the markdown is compiled in as string literals, the way a
constant would be.

Notice what the `*` wildcards buy: drop a new file into
`content/locales/en/products/` and it is on the site at the next build,
with zero registration anywhere. This is chapter 1's golden rule — content
is data, code is layout — implemented in one expression. The code never
knows how many reviews exist; it vacuums up whatever the folders contain.

The same pattern pulls in compass chapters (`compass/**/*.md`), pages, `site.yaml`,
the theme palettes, and even the SVG diagram templates you'll meet below.

## Frontmatter: one file, two kinds of content

Each markdown file is really two documents in one:

- the **YAML frontmatter** between the `---` fences — structured data
  (title, rating, date, tags) that code can sort, filter and render as
  stars or chips;
- the **markdown body** — prose for humans.

`content.ts` splits them with a small function, `parseFrontmatter()`: a
regex peels off the leading `---` block, the `yaml` package parses it into
an object, and the rest is the body. The parsed fields are then spread into
typed objects — `Product`, `Guide`, `Page` in `src/lib/types.ts` — so the
rest of the codebase autocompletes and type-checks against real shapes.

One detail is worth your attention because it generalizes: the obvious
library for this job is `gray-matter`, which every blog tutorial reaches
for. This repo uses the `yaml` package directly instead — because
`gray-matter` depends on Node's `Buffer`, which doesn't exist in a browser,
and *this parsing runs inside the bundle*. Every dependency here has to
answer the question "will this run at browse time, in a browser, with no
Node?" That question — what runs where — is the two-phase machine again,
now making library choices for you.

## The filename is the URL

Where does a review's address come from? From nothing but its path:
`products/organic-cotton-swaddle.md` becomes
`/reviews/organic-cotton-swaddle`. The slug is the filename minus `.md`;
nothing anywhere registers or hardcodes it.

This has a consequence worth engraving: **renaming a file changes a public
URL**. Rename casually and every external link to that review breaks. It
also has a gift: the URL structure of the entire site is visible in a file
listing, and two locales stay linked by simply *sharing filenames* —
`en/products/x.md` and `ru/products/x.md` are the same page in two
languages. When a Russian file is missing, the loader falls back to the
English one per-slug, so a half-translated site never shows a hole.

```diagram build-pipeline-flow
aria: "The build pipeline: a markdown file on disk is globbed into the bundle as a raw string, split into frontmatter and body, the YAML is parsed into typed fields, the body is rendered to HTML, and the result is a typed object inside the bundle"
s1: "file on disk"
s1sub1: "content/…/x.md"
s1sub2: "YAML + prose"
s2: "glob import"
s2sub1: "Vite, build time"
s2sub2: "raw string in JS"
s3: "split + parse"
s3sub1: "frontmatter → data"
s3sub2: "typed fields"
s4: "render body"
s4sub1: "marked → HTML"
s4sub2: "ids, diagrams"
s5: "object"
s5sub1: "in the"
s5sub2: "bundle"
footer: "Slug = filename. Every step runs at build time or in the browser — never on a server."
caption: "The whole content pipeline. Trace any sentence on this site backwards along this line and you land on a file you can open."
```

## The markdown renderer and the trust boundary

The body is turned into HTML by `marked`, a small markdown compiler, and
injected into the page with React's `dangerouslySetInnerHTML`
(`src/components/Markdown.tsx`). If you have any frontend security
instincts, that API name just raised your hackles — injecting raw HTML is
how XSS happens.

It is safe here for exactly one reason, and the reason deserves a name:
**the trust boundary**. Every byte of markdown on this site is written by
the site's own authors and shipped inside the bundle. There is no user
input, no comments, no query-string reflection — nothing crosses from an
untrusted source into that HTML. `dangerouslySetInnerHTML` is dangerous
*for content you don't control*; this site simply has none. The day it
accepts untrusted markdown is the day this decision must be revisited —
and the code comments say so out loud. Keep the concept in hand: chapter 4
applies the same boundary-drawing to third-party code, where this repo is
much *less* trusting than the industry default.

Two custom touches ride on top of `marked`, both in `content.ts`:

- **Heading ids.** A custom renderer stamps every `h2`/`h3` with an id
  slugified from its text (Cyrillic transliterated), which is what makes
  the table of contents beside this article clickable and every heading
  linkable.
- **Diagrams.** The figures you've seen in this course are not images. A
  fenced code block marked `diagram <name>` is intercepted at render time:
  the named SVG template is loaded from `content/shared/diagrams/`, its
  `{{slot}}` tokens are filled from the block's YAML (every value
  HTML-escaped), internal SVG ids are suffixed per-instance so two diagrams
  on one page can't collide, and the result is wrapped in a `<figure>`.
  Geometry is drawn once and shared; each locale supplies only its own
  text. And if a template or slot is broken, the renderer shows a visible
  ⚠ caption instead of throwing — because in an SPA, one uncaught
  exception at render time doesn't break a widget, it blanks the entire
  site. Degrade loudly, but degrade.

## Worked example: this page, traced

Apply the pipeline to the page you are reading. This chapter is
`content/locales/en/compass/inside-websites/inside-02-from-markdown-to-bundle.md`.
At build time the compass glob vacuumed it in as a string. `parseFrontmatter`
read `title`, `chapter: 2`, and `tags` — the first tag, `inside-websites`,
is what places it in this course's tab on the Compass page (membership is
data, not folder structure; the subfolder is just tidiness). `marked`
rendered this prose, stamped the heading ids that the table of contents is
using right now, and expanded one `diagram` block into the SVG above. The
result — one typed `Guide` object in the bundle — is what the browser is
painting for you at this moment. Every claim in this chapter is checkable
against that one file, which is the standard this whole course holds
itself to.

## Practice

Add a piece of content to your copy of the site — the artifact from
chapter 1 — without touching `src/`. Reviews need zero wiring, so add a
review of any object on your desk (30–40 minutes):

1. Create `content/locales/en/products/my-test-review.md`.
2. Give it real frontmatter: `title`, `category`, `rating`, `excerpt`,
   `date` (today), and a couple of `tags`. Copy the shape from any existing
   product file.
3. Write three honest sentences of body. Add a `## Verdict` heading.
4. Save, with `task dev` running, and open `/reviews/my-test-review`.
5. Then rename the file to `desk-lamp.md` and watch the old URL die and
   `/reviews/desk-lamp` appear — the slug rule, demonstrated.

**How to know it worked:** your review has a card on `/reviews`, a working
detail page, its `category` appeared as a filter chip — and `git status`
shows changes under `content/` only.

## Now you can

- Trace any sentence on this site to the file it came from, and name each
  pipeline step in between.
- Explain what `import.meta.glob` does, when it runs, and why there's no
  `fs.readFile` anywhere.
- Split a content file into frontmatter and body, and say which one code
  sorts by and which one humans read.
- State the trust boundary and judge when `dangerouslySetInnerHTML` is
  safe — and when it stops being safe.
- Predict the URL of any content file, and the blast radius of renaming it.

## Check yourself

Answer from memory:

1. Why must the whole content pipeline run at build time — what's missing
   at browse time that makes the alternative impossible?
2. Why does this repo parse YAML with the `yaml` package instead of
   `gray-matter`, and what general question does that answer teach you to
   ask of any dependency?
3. What single fact determines a review's URL, and what breaks if you
   change it?
4. Why is `dangerouslySetInnerHTML` safe on this site, and what future
   feature would make it unsafe?

## Next

Here is the strange thing you've now earned the right to notice: the bundle
carries every page, every review, both languages — yet when you click
between them, the network tab stays silent and the page never reloads. Who,
exactly, is doing the navigating? Chapter 3 opens the browse-time half of
the machine: the component tree, the router, and the state that makes one
HTML page act like a whole site.

**[Chapter 3: The Living Page →](/compass/inside-03-the-living-page)**
