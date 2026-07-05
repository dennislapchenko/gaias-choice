---
title: "The Whole Machine: What a Modern Frontend Site Actually Is"
excerpt: The two-phase machine, the bundle, the one HTML page — the entire architecture of this site in one chapter, plus getting it running on your own machine.
image: /images/guide-inside-01-the-whole-machine.svg
date: 2026-07-05
chapter: 1
tags: [inside-websites, architecture]
---

> **Chapter 1 of 5 · The Gate** — [Chapter 2: From Markdown to Bundle →](/compass/inside-02-from-markdown-to-bundle)
> *You're at the start* — the map of the whole course is in this chapter.
> *This chapter adds:* the core mental model of the machine, its four layers, and a copy of it running on your own machine.

> **Engine-room course.** Written to explain this very site's code to our own
> team — every file path named here is real; the site you're reading is the
> lab.

## The question this course answers

You are reading a page of this site right now. Sometime in the last minute,
your browser turned a URL into this paragraph. If your job is *around*
software — you deploy it, design for it, monitor it — you have probably
shipped a hundred frontends without ever being shown what happens in that
minute. Frontend tutorials start too low (here's a button component) and
DevOps runbooks start too high (here's the container, don't look inside).

This course walks the whole machine top to bottom, using this site's own
code as the single running example. Not a toy repo built for teaching — the
actual production code serving the page you're reading. By chapter 5 you
should be able to read the entire codebase in one sitting and, more
importantly, know how you would build the next one yourself.

```diagram inside-course-map
aria: "The five chapters: chapter 1 the whole machine, chapter 2 the build, chapter 3 the browser runtime, chapter 4 delivery and supply chain, chapter 5 owning the stack"
stage1: "THE GATE"
stage2: "THE PATH"
stage3: "THE SUMMIT"
ch1a: "1 · The"
ch1b: "machine"
ch1sub: "this chapter"
ch2a: "2 · The build"
ch2sub1: "markdown in,"
ch2sub2: "bundle out"
ch3a: "3 · The page"
ch3sub1: "React, routes,"
ch3sub2: "state"
ch4a: "4 · The box"
ch4sub1: "Docker, nginx,"
ch4sub2: "supply chain"
ch5a: "5 · Own"
ch5b: "the stack"
ch5sub: "read it all, rebuild it"
footer: "One real site, four layers, top to bottom — each chapter is one layer of the same machine."
caption: "The course at a glance: chapter 1 gives you the whole machine in miniature; chapters 2–4 each open one layer; chapter 5 makes it yours."
```

## The two-phase machine

Here is the single most load-bearing fact about this site, the one every
later chapter leans on. Everything that happens, happens in exactly one of
two places:

1. **Build time** — once, in a container, when the site is compiled. A tool
   called Vite reads every source file and every piece of content and
   produces a folder of plain static files.
2. **Browse time** — in *your* browser, every visit. The JavaScript produced
   at build time runs on your machine and paints every page you see.

Call it **the two-phase machine**. Between the two phases there is nothing:
no application server, no database, no API, no code executing per-request.
The "server" is nginx handing out files, the same way it would hand out
photos. If you have operated backends, this is the part to sit with — the
entire category of runtime backend failure (connection pools, migrations,
N+1 queries, cache invalidation) does not exist here, because there is no
runtime backend. The price paid for that will get an honest accounting in
chapter 5.

```diagram two-phase-machine
aria: "Build time on the left: content files and source code go into Vite, which produces the bundle. Browse time on the right: the browser downloads the bundle once, JavaScript paints every page, and navigation stays local."
buildTitle: "BUILD TIME — once, in a container"
runTitle: "BROWSE TIME — every visit"
srcContent: "content/"
srcContentSub: "markdown + YAML"
srcCode: "src/"
srcCodeSub: "TypeScript + React"
tool: "Vite"
toolSub: "compile + bundle"
bundle: "dist/"
bundleSub: "static files"
run1: "browser downloads the bundle"
run2: "JavaScript paints the page"
run3: "clicks never leave the tab"
footer: "The handoff between the phases is a folder of plain files — nothing executes in between."
caption: "The two-phase machine. Everything in this course lives on one side of this wall or the other, and knowing which side answers most questions before you ask them."
```

## The bundle: dist/ is the site

Run the build and you get a folder called `dist/`. That folder **is the
entire site**: one `index.html`, a couple of hashed `.js` and `.css` files
under `assets/`, and the images. You could delete the whole repository,
keep `dist/`, and serve it from any static file host — nothing would break.
Call this **the bundle**.

This is worth saying because it inverts the usual mental model. The
repository is not the site; the repository is the *recipe*. Deployment
(chapter 4) is nothing more than cooking the recipe in a container and
putting the resulting folder behind nginx. There is no "app" to keep alive,
only files to keep reachable.

## The one HTML page

Now the strange part. Open this site, then view the page source
(`view-source:` in the URL bar, or Ctrl+U). You will find a nearly empty
HTML document: a `<div id="root"></div>` and a script tag. None of the text
you are reading appears in it.

That is because this is a **single-page application (SPA)**: the server only
ever serves that one HTML file — **the one HTML page** — and the JavaScript
builds everything you see, directly in your browser, after it loads. When
you click from Reviews to Compass, no new page is fetched; the JavaScript
swaps what's painted inside that one page and rewrites the URL bar so it
*looks* like you navigated. Chapter 3 opens that machinery; chapter 4 shows
the one nginx line that keeps it from breaking; chapter 5 weighs its real
costs.

If you remember nothing else from this chapter: **the site you're browsing
is one HTML page plus a program**, and the program was compiled from the
repository at build time.

## Content is data, code is layout

The last Gate concept is the repo's golden rule, and the reason a
non-developer can co-own this site. Look at the top level of the
repository — the files split into two populations:

| Where | What lives there | Who touches it | Language |
| --- | --- | --- | --- |
| `content/` | every review, guide, page, the site name, nav, the color palettes | the authors | Markdown + YAML |
| `src/` | how content is loaded, laid out and painted | the developer | TypeScript + React |
| `public/images/` | photos and generated SVG art | the authors | — |
| `scripts/`, `Dockerfile`, `Taskfile.yml`, `nginx/` | build, art generation, packaging, serving | the developer / ops | mixed |

The rule — **content is data, code is layout**: adding or editing a review,
a guide, or a whole color theme must never require touching `src/`. Writing
a new review means creating one markdown file. Adding a palette means
appending a few lines of YAML. If a content change ever forces a code
change, the content model is being bypassed, and the fix is to repair the
model — not to hand-edit components.

This split is not cosmetic. It is what makes the two-phase machine safe to
operate as a family business: the person writing reviews cannot break the
renderer, and the person refactoring the renderer cannot silently change
what a review claims. Every serious CMS is an industrial version of this
same idea; here it is small enough to read in an afternoon.

## The four layers, named

Those are the Gate concepts — the two-phase machine, the bundle, the one
HTML page, content-is-data. The rest of the course opens the machine layer
by layer, top to bottom:

- **Chapter 2 — the build.** How a markdown file with a YAML header becomes
  typed data inside the bundle: the glob import, the frontmatter parser,
  the markdown renderer, and why the filename is the URL.
- **Chapter 3 — the browser.** What runs at browse time: the React
  component tree, client-side routing, state, and how language and theme
  switching actually work.
- **Chapter 4 — the box.** Your home turf if you're ops: the multi-stage
  Docker build, the nginx config, why pushing to `main` is a deploy, and
  the supply-chain discipline that keeps npm at arm's length.
- **Chapter 5 — the summit.** No new machinery: a one-sitting reading order
  for the whole codebase, the honest ledger of why this architecture and
  not another, where it breaks, and how you'd rebuild it from zero.

## Your copy of the machine

This course builds one artifact: **a working copy of this site on your
machine, changed by you at every layer**. Each chapter's practice modifies a
different layer, and chapter 5's exam ships one change through all of them.
It starts now, with the smallest possible version: run the machine and
change one piece of data.

## Practice

You need `git`, Docker, and [Task](https://taskfile.dev) installed — and
notably *not* Node.js, for reasons chapter 4 turns into a whole discipline.

1. Clone the repository and run `task dev` from its root. The first run
   installs dependencies inside a container (watch the output — nothing
   installs onto your host), then starts a dev server.
2. Open `http://localhost:5173`. You are now serving the site to yourself.
3. Open `content/locales/en/site.yaml` in any editor. Change `tagline:` to
   anything you like and save.
4. Watch the browser. It updates by itself, without a reload — that's
   Vite's hot module replacement, a build-time tool reaching into browse
   time, and it only exists in development.

**How to know it worked:** your own words are in the hero of your own copy
of the site, and you never touched a file inside `src/`.

## Now you can

- Explain the two-phase machine and place any given piece of work (parsing
  markdown, switching themes, serving a request) on the correct side of it.
- Say what the bundle is and why the repository is a recipe, not a site.
- Describe what an SPA is from the evidence of an almost-empty page source.
- State the golden rule — content is data, code is layout — and use it to
  predict which files a given change should touch.
- Run this site locally and change its content without touching code.

## Check yourself

Answer from memory:

1. What executes between build time and browse time, and what does that
   imply about entire categories of backend failure?
2. If you deleted everything except `dist/`, what would still work, and why?
3. The page source is nearly empty, yet you're reading a full page — where
   did the text come from?
4. A teammate asks you to change the site's tagline and add a new color
   palette. Which directories do you touch, and which do you refuse to?

## Next

The bundle doesn't write itself. Chapter 2 follows one markdown file — YAML
header, prose, diagram and all — through the exact pipeline that turns it
into typed data inside the bundle, and shows why renaming a file changes a
URL.

**[Chapter 2: From Markdown to Bundle →](/compass/inside-02-from-markdown-to-bundle)**
