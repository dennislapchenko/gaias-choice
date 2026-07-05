---
title: "The Living Page: React, Routes and State"
excerpt: The browse-time layer — the component tree, client-side routing, state and hooks, and how theming and language switching really work.
image: /images/guide-inside-03-the-living-page.svg
date: 2026-07-05
chapter: 3
tags: [inside-websites, react]
---

> **Chapter 3 of 5 · The Path** — [← Chapter 2: From Markdown to Bundle](/compass/inside-02-from-markdown-to-bundle) · [Chapter 4: Shipping the Box →](/compass/inside-04-shipping-the-box)
> *You can already:* trace any sentence on this site back to its file, through every build step.
> *This chapter adds:* the browse-time half of the machine — you'll be able to read the component tree top to bottom and explain every click, repaint, and remembered preference.

> **Engine-room course.** Written to explain this very site's code to our own
> team — every file path named here is real; the site you're reading is the
> lab.

## The silent network tab

Open this site with the browser's dev tools on the Network tab. Click from
Reviews to Compass to a guide and back. After the first load: near-silence.
No HTML is fetched, no page reloads, yet the URL bar changes, Back and
Forward work, and every page paints instantly.

Chapter 2 ended on this question, and you already hold both halves of the
answer — recall **the one HTML page** from chapter 1, and recall what
chapter 2 showed was inside **the bundle**. Put together: the browser
already has every page's content; something in JavaScript is deciding what
to paint. This chapter is about that something. It has three parts — a tree
of components, a router, and state — and they are the whole of browse time.

## The component tree

React's model in one paragraph: the UI is a tree of **components** — plain
functions that return a description of markup. A component for a star
rating, composed into a card, composed into a grid, composed into a page.
When something changes, React re-runs the affected functions and patches
the real page to match — you never write "find this element and update its
text"; you re-describe the result and React reconciles.

This site's tree has a spine you can read in two files. `src/main.tsx`
plants the root: it mounts `<App/>` into that one empty
`<div id="root">` from chapter 1, wrapped in two providers you'll meet
below. `src/App.tsx` is the route table — the full list of everything this
site can show. `components/Layout.tsx` wraps every page with the header,
sidebar and footer; the `pages/` directory holds one component per screen;
`components/` holds the reusable parts they share. That's the entire
inventory. When this paragraph appeared on your screen, the call chain was:
`main.tsx` → `App` → `Layout` → `EntryDetail` → `Markdown` — and you know
from chapter 2 where `Markdown` got its HTML.

## The router: navigation without navigating

The router (`react-router-dom`) is the piece that fakes multi-page behavior
on top of the one HTML page. `App.tsx` declares the mapping:

| URL | Component | Content source (ch. 2) |
| --- | --- | --- |
| `/` | `Home` | `site.yaml` + latest items |
| `/reviews` | `Reviews` | all products, category chips |
| `/reviews/:slug` | `ReviewDetail` | one product file |
| `/compass` | `Compass` | epics from `site.yaml`, chapters by first tag |
| `/compass/:slug` | `EntryDetail` | one compass file — this page |
| `/about`, `/roadmap`, … | `MarkdownPage` | one page file each |
| anything else | `NotFound` | — |

When you click a `<Link>`, the router intercepts the click before the
browser can do a real navigation, rewrites the URL bar with the History
API (`pushState` — address changes, nothing loads), and re-renders: the
route table matches the new path, `:slug` falls out as a parameter,
`EntryDetail` asks the content layer for that slug, and the tree repaints.
The "page change" you perceive is one component being swapped inside
`Layout`.

```diagram spa-render-flow
aria: "Client-side navigation: a link is clicked, the router intercepts it and updates the URL with the History API, the route table matches a component, and React repaints the tree — while the server is never contacted"
s1: "click a link"
s1sub1: "<Link> caught"
s1sub2: "before the browser acts"
s2: "URL rewritten"
s2sub1: "history.pushState"
s2sub2: "no load, Back works"
s3: "route matched"
s3sub1: "App.tsx table"
s3sub2: ":slug → params"
s4: "repaint"
s4sub1: "React patches"
s4sub2: "the one page"
server: "the server"
serverSub: "not contacted"
note: "content is already in the bundle — nothing to fetch"
footer: "Navigation is a state change, not a page load — that's the whole SPA trick."
caption: "What a click actually does. The crossed-out box is the point: at browse time the server has already done its only job."
```

## State: what the page remembers

If navigation is a state change, what is state? **State is any value that,
when it changes, should change what's painted.** React's `useState` hook is
the primitive: a component declares a value, gets back the value and a
setter, and calling the setter triggers the re-render.

You met real state without knowing it in chapter 2's practice: the Compass
page's course tabs. `Compass.tsx` holds
`useState<string>` with the active epic's tag; clicking a tab calls the
setter; the list of chapters below re-filters. No cache to invalidate, no
DOM to patch by hand — data changed, tree re-rendered. Most of this site
barely needs state (the content is static, after all); where it appears, it
is exactly this small.

Two preferences, though, need to be remembered *across visits* and shared
*across the whole tree* — your language and your color theme. They
demonstrate the two remaining state tools, and they're the last new ideas
in this chapter.

## Case study: language, or state that every component needs

The language switcher can't use local `useState` — the nav, the sidebar,
every card, every button label needs the current locale. React's answer to
"state that many distant components share" is **context**: a provider at
the top of the tree (`I18nProvider` in `src/lib/i18n.tsx`, wrapped around
`App` in `main.tsx`) that any descendant can read with a hook —
`useI18n()`.

The provider owns three things: the current `locale`, the setter the flag
button calls, and `t()` — the lookup that turns keys like
`'reviews.title'` into strings from `src/locales/en.ts` or `ru.ts`. Note
the boundary running through here, one you already know: chrome strings
(button labels, nav) live in code dictionaries, page content lives under
`content/` — that's chapter 1's content-is-data rule deciding where each
kind of text belongs. And when the locale changes, components re-ask the
content layer, whose per-slug English fallback (chapter 2) quietly covers
anything untranslated.

The choice persists in `localStorage['gc-lang']` — a tiny key-value store
the browser keeps per site — which is how your copy remembers Russian
across a restart with no server and no cookie.

## Case study: theming, or state that leaves React entirely

The theme switcher is the more elegant trick, and it barely uses React at
all. Every color in `src/styles.css` is a **CSS variable** — rules say
`var(--sage)`, never a hex code. The palettes themselves are data
(`content/themes.yaml` — add one and you've added a theme, no code), and
switching themes is just `src/lib/theme.ts` writing ten variables onto the
`<html>` element. Every rule that references them updates instantly;
React never re-renders — this repaint belongs to CSS, not to the component
tree. Even the SVG diagrams you've seen recolor, because their fills are
the same variables.

Persistence is `localStorage['gc-theme']` again, plus one subtlety worth
stealing for any project: `initTheme()` runs in `main.tsx` *before* React
mounts, so a saved dark-ish palette applies before the first paint instead
of flashing the default for a frame. Order of operations at startup is a
real design surface.

## Practice

Add your own theme to your copy of the site — the artifact grows a layer-3
piece (30–45 minutes, dev tools open):

1. With `task dev` running, open dev tools → Application → Local Storage.
   Switch themes and languages in the header and watch `gc-theme` and
   `gc-lang` change. Then inspect `<html>` in the Elements tab and watch
   the inline `--sage`, `--mint`, … variables rewrite as you switch.
2. Open `content/themes.yaml`. Copy the palette whose structure you like
   best, give it your own `tag`, `label`, and colors.
   Pick `onAccent` for contrast against your `sage` (white on deep accents,
   dark ink on light ones).
3. Save and pick your palette in the switcher. Reload — it should survive.
4. Check `git status`: only `content/themes.yaml` changed. You restyled an
   entire site without touching a stylesheet — say out loud which rule made
   that possible.

**How to know it worked:** your palette is in the switcher menu, the whole
site (diagrams included) wears your colors, and the choice survives a
browser restart.

## Now you can

- Read the component tree from `main.tsx` down and name what each level
  contributes to the page you're looking at.
- Explain a click on this site end to end: interception, `pushState`,
  route match, re-render — and why the network stays silent.
- Define state operationally and point to the smallest real example of it
  in this codebase.
- Explain when context earns its place over local state, using the locale
  as the example.
- Describe the CSS-variable theming trick and why the theme repaint never
  touches React.

## Check yourself

Answer from memory:

1. The URL bar changes but no request is made — which two APIs conspire to
   make that possible, and who calls them?
2. Why is the epic tab on the Compass page `useState`, while the locale is
   context? What breaks if you swap the choices?
3. Trace what happens between choosing a palette and the page changing
   color. How many React re-renders are involved?
4. Why does `initTheme()` run before React mounts, and what would you see
   if it ran after?

## Next

One thing in this chapter was quietly load-bearing: the router matching
`/compass/inside-03-the-living-page` *assumed the JavaScript was already
running*. But paste a deep link into a fresh tab and the very first request
goes to a server that has only static files and no router. On a naive
static host, that's a 404 — yet on this site it works. Chapter 4 descends
into your home turf — the container, the one nginx line that fixes exactly
this, and the supply-chain rules this repo enforces before any of it is
allowed to ship.

**[Chapter 4: Shipping the Box →](/compass/inside-04-shipping-the-box)**
