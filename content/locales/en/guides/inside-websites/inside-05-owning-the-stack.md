---
title: "Owning the Stack: Read It All, Judge It, Rebuild It"
excerpt: The summit — the one-sitting reading order, the honest ledger of why this architecture, where it breaks, and the end-to-end exam.
image: /images/guide-inside-05-owning-the-stack.svg
date: 2026-07-05
chapter: 5
tags: [inside-websites, stack]
---

> **Chapter 5 of 5 · The Summit** — [← Chapter 4: Shipping the Box](/guides/inside-04-shipping-the-box) · after this: [where to go next](#beyond-this-course)
> *You can already:* explain all four layers — content, build, browser, box — one layer at a time.
> *This chapter adds:* no new machinery. It makes the machine yours: read it whole, judge its tradeoffs, and know how you'd build the next one.

> **Engine-room course.** Written to explain this very site's code to our own
> team — every file path named here is real; the site you're reading is the
> lab.

## No new fundamentals

Fair warning: this chapter is work. Not because it introduces anything new —
it deliberately introduces nothing — but because it asks every previous
chapter to be true in your head *at the same time*. That's the difference
between having taken a course and owning a stack, and it doesn't come free.
If chapters 1–4 gave you a working understanding and that's what you came
for, you have it; stop here with a clear conscience. If you want to be the
person who could have *built* this — and could build the next one — climb.

## The whole codebase in one sitting

Set aside ninety minutes with the repo open and read it in this order. The
order matters: it follows the two-phase machine from boot to byte, and
every stop is something you already know — now watched in its habitat.

| Stop | File | What to notice |
| --- | --- | --- |
| 1 | `content/locales/en/site.yaml` | the site as data: nav, epics, sidebar — config, not code |
| 2 | `src/main.tsx` | boot order: `initTheme()` and `initI18n()` *before* React mounts (ch. 3's no-flash trick) |
| 3 | `src/App.tsx` | the route table — the site's entire surface in one screen (ch. 3) |
| 4 | `src/lib/content.ts` | the heart: globs, frontmatter, `marked`, heading ids, the diagram renderer, locale fallback (ch. 2 — this is the long stop) |
| 5 | `src/lib/types.ts` | the shapes everything shares — read it as the data model |
| 6 | `src/components/Layout.tsx` → one page (`pages/Guides.tsx`) | tree spine + the one `useState` you already met (ch. 3) |
| 7 | `src/lib/theme.ts`, `src/lib/i18n.tsx` | the two case studies, now trivially readable |
| 8 | `src/styles.css` | one stylesheet, CSS variables throughout — search `var(--` and count |
| 9 | `Dockerfile`, `nginx/default.conf.template` | the box and the fallback line (ch. 4) |
| 10 | `Taskfile.yml`, `.npmrc`, `package.json` | the interface and the supply-chain rules — note the tiny `dependencies:` block (ch. 4) |

Two side rooms you can now walk into without a guide: `src/lib/astro.ts`
(the sidebar almanac — a real in-browser ephemeris; the same build-time
globbing and browse-time rendering, applied to astronomy instead of
markdown) and `scripts/generate-mandala.mjs` (the art on the cards,
including this chapter's — generated SVG, config over assets, the same
data-over-code instinct at yet another layer).

The test of the sitting: at every stop, you should be saying "I know why
it's like this" — and when you can't, you've found a real question. Write
those down; they're the honest measure of what's left.

## The decision ledger

Nothing in this stack is default. Each choice was made against live
alternatives, paid for something, and bought something. The ledger, in the
order the forces arrive:

**Why an SPA at all — and not WordPress, not Next.js?** The honest
comparison, since this is the decision the whole course rests on:

| | This site (client-rendered SPA) | Static-site generator (Astro, Hugo…) | Server-rendered (Next.js…) | CMS (WordPress…) |
| --- | --- | --- | --- | --- |
| First HTML the reader gets | nearly empty — JS paints | full page | full page | full page |
| Runtime moving parts | none — files + nginx | none | Node server (or platform) | PHP + database |
| Ops burden | ~zero | ~zero | real | real, plus updates forever |
| Instant in-page navigation | yes (ch. 3) | per setup | yes | no |
| What crawlers/previews see | almost nothing | everything | everything | everything |

Given a two-person family business with a devops background, no content
team, and no appetite for servers to babysit: the SPA's column wins on
everything except one row — and that row is the architecture's real debt,
handled below. But hold the comparison honestly: for a *content site*, the
static-site generator column is the industry-standard answer, and it is a
strong one. This stack chose the SPA and accepts the debt knowingly; the
roadmap (below) is the repayment plan. If you rebuild for yourself, decide
per that table, not per fashion — and know that this repo would have been
almost as happy as an Astro site.

**Why five dependencies?** Chapter 4 made the security case. The deeper
reason is comprehension: this course exists *because the stack is small
enough to teach*. Every dependency you don't add is documentation you don't
owe.

**Why no CMS, no database?** Because chapter 2's pipeline makes the
filesystem the CMS: files, folders, and git as the editorial history. The
price is that editors must be comfortable with markdown and a text editor —
acceptable when the editors are the owners.

**Why filename-as-URL, YAML-in-markdown, themes-as-data?** All one
decision wearing three costumes: content is data, code is layout. By now
you can argue it from consequences — every practice in this course changed
the site without touching `src/`, and that was the rule working, not luck.

## Where it breaks

Chapter 4's seed, paid in full. Run chapter 1's `view-source:` experiment
once more, but read it now as a crawler: title, empty div, script tag. A
search engine that doesn't execute JavaScript, a social-preview fetcher, a
Pinterest bot — each sees a blank site. For an affiliate content business
whose chapter-3-of-the-*founder*-course traffic plan leans on search and
Pinterest, that is not a footnote; it is the architecture's one real debt,
and it is on the public [roadmap](/roadmap) as the top engineering item:
**build-time prerendering**. Every route is knowable at build time (the
slugs are just filenames — chapter 2), so the build can visit each one,
capture the painted HTML, and write it into the bundle — full pages for
crawlers, the same instant SPA for humans after the JavaScript wakes up.
No architecture change, one more build step; the two-phase machine
absorbs it without moving the wall.

Know the other limits' shape too: every locale's every page rides in one
bundle (fine at dozens of pages, wrong at ten thousand — the almanac's
`astronomy-engine` is already most of the JS weight); there's no
per-request logic anywhere, so the moment you need accounts, comments, or
paywalls, you're adding a backend and this stops being this architecture;
and content updates require a rebuild — there is no "publish now" button,
only a push (chapter 4 taught you that's a feature as much as a cost).

## Rebuilding it from zero

The final ownership test: could you start an empty folder and end up here?
The skeleton is seven moves, each one a chapter you've already had:

1. **Scaffold** — `npm create vite@latest` (React + TypeScript), inside a
   container from the first command (ch. 4's rules start at minute one,
   not at deploy time).
2. **Routes** — `react-router-dom`, a route table, a `Layout` (ch. 3).
3. **The content pipeline** — a `content/` tree, `import.meta.glob`,
   frontmatter split, `marked` (ch. 2 — this is the day of real work).
4. **Types** — the `Product`/`Guide`/`Page` shapes, so the compiler holds
   the content model honest (ch. 2).
5. **One stylesheet on CSS variables** — theming becomes data for free
   (ch. 3).
6. **The box** — multi-stage Dockerfile, nginx template, the `try_files`
   line (ch. 4).
7. **The gates** — Taskfile, `.npmrc` with `ignore-scripts`, lockfile,
   audit-at-zero, CI that builds on push (ch. 4).

Everything else this site has — locales, themes, the almanac, generated
art, diagram templates — is an *iteration* on that skeleton, added when a
need was real. That's the other thing to copy: the order. Skeleton first,
features when they hurt.

## Teaching yourself the remaining 80%

This course taught the load-bearing 20%. The rest you can now get on your
own, and the method matters more than the reading list: **never believe a
claim about this stack that you can't reproduce against the running site.**
You've been doing it all course — view-source for chapter 1's claims, the
network tab for chapter 3's, `curl` for chapter 4's. The running machine is
the instrument; every claim is checkable; check them. Documentation that
disagrees with your dev tools is wrong, old, or misread — all three are
useful discoveries.

Where the depth lives, when you want it: Vite's guide (build), MDN
(everything browser — the History API, CSS variables, `localStorage`),
React's own docs (their "thinking in React" pages are the canonical version
of chapter 3), nginx's docs (`try_files` has more depth than one line), and
OWASP's dependency-security material (chapter 4's table, industrial
strength). Read them *after* meeting the ideas here, with the repo open —
reference beats tutorial once you own a working example.

## The exam

No new practice — the exam is the artifact. Your copy of this site already
carries your tagline (ch. 1), your review (ch. 2), your palette (ch. 3),
and has shipped through the production pipeline (ch. 4). Close the loop
end to end, alone:

1. Make one real content change — a new review, or a rewrite of your
   chapter-2 one with an honest verdict section.
2. Run the full gate: `task verify`.
3. Build and run the box; check your change *and* one deep link on :8080.
4. Then, from memory, write the path your change took from keyboard to
   painted pixel — every stop, both phases. Check yourself against chapter
   2's diagram and chapter 4's.

**How to know it worked:** the written trace has no gaps you papered over
with "and then somehow" — that was chapter 1's promise, kept or not.

## Now you can

- Read this entire codebase in one sitting and know, at every stop, why
  it's like this.
- Argue the architecture from a tradeoff table — including the honest case
  for its strongest rival.
- Name the stack's real debt, the shape of its repair, and the limits that
  would end this architecture.
- Rebuild the skeleton from an empty folder in seven moves, gates first.
- Verify any claim about a frontend stack against the running system
  instead of taking it on authority.

## Check yourself

Answer from memory:

1. What does a non-JavaScript crawler see on this site today, why does it
   matter *for this specific business*, and what's the planned fix?
2. Under what three kinds of growth does this architecture stop being the
   right one?
3. In the seven-move rebuild, why do the supply-chain gates come at minute
   one instead of before deploy?
4. A blog post claims "SPAs can't do SEO." Using this course, what's the
   more precise truth, and what experiment would you run to check it?

## Beyond this course

You've read the machine; the other half of this site's story is the
*business* that machine serves — traffic, trust, honest money. That course
is already here, taught on the same live example:
[«An honest site from zero»](/guides/kickstart-playbook), five chapters,
same format. And the [roadmap](/roadmap) is where you watch this stack's
own next chapter — prerendering — land in public.

The machine is yours now. Build the next one.
