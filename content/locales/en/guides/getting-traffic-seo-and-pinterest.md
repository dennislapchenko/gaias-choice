---
title: "Getting Traffic: SEO, Pinterest, and Patience"
excerpt: How people will actually find this site — keyword research for beginners, why Pinterest fits this niche, and the technical SEO work our stack needs.
image: /images/guide-packing-light.webp
date: 2026-07-02
tags: [founder-guide, seo, traffic]
---

> **Founder guide.** Written for us while we bootstrap the site — see the
> [Kickstart Playbook](/guides/kickstart-playbook) for context.

Traffic for a site like ours comes from three places, in this order of
importance: **Google search**, **Pinterest**, and everything else. Instagram
and TikTok are optional; search and Pinterest are the business.

## How search traffic actually works for a review site

People type questions with buying intent — *"best glass baby bottles for
travel"*, *"are beeswax wraps safe for baby food"*, *"merino sleep sack worth
it"* — and Google tries to surface pages written by someone who genuinely
knows. Two things matter for us:

1. **First-hand experience, provably.** Google's review-system updates
   explicitly reward evidence of real use: original photos, measurements,
   drawbacks, comparisons. Our
   [review process](/guides/writing-reviews-that-earn-trust) produces exactly
   this — not as an SEO trick, but the incentives align perfectly.
2. **Topical focus.** Thirty pieces about one narrow topic (natural gear for
   traveling with a baby) outrank three hundred scattered ones. We stay narrow
   until we've won the niche.

### Keyword research without paid tools

For each planned piece, spend fifteen minutes:

- Type the topic into Google and note the **autocomplete** suggestions — that's
  literal demand data.
- Check the **"People also ask"** boxes — each question is a section heading or
  its own future piece.
- Look at who currently ranks. Big magazine with no real photos? We can win
  with genuine experience. Established niche site with great first-hand
  content? Pick a longer-tail angle instead (*"…for carry-on only"*, *"…that
  survive machine washing"*).
- Prefer **long, specific phrases**. We cannot rank for "baby bottles" this
  decade. We can rank for "glass baby bottles that fit in a carry-on" this year.

Keep a running list of these phrases — that list *is* the editorial calendar.

## Pinterest: the under-priced channel for exactly this niche

Eco-parenting checklists, packing lists, and "natural swaps" content is core
Pinterest material, and Pinterest behaves like a search engine, not a social
feed — a good pin drives traffic for **years**, not hours.

- Create a **business account** with a board structure mirroring our categories
  (sleep, feeding, packing lists…).
- Every guide gets a **tall pin image** (2:3 ratio, text overlay stating the
  benefit). Every review gets at least one.
- Pin consistently (a few per week) rather than in bursts. Link every pin to
  the specific page, not the homepage.
- Checklists and "X swaps for Y" formats massively outperform prose on
  Pinterest — good news, since that's half our content plan anyway.

## The technical SEO gap in our stack (dev tasks)

The site is a **client-rendered SPA**: every URL serves an empty HTML shell and
the content appears via JavaScript. Google *can* render this, but for a site
whose entire business is organic search it's a real handicap — and Pinterest
and social previews don't run JS at all. Concretely missing today:

- **Per-page `<title>` and meta description** — every route currently shows the
  same homepage title. Cheap first step: set `document.title` on route change.
- **Prerendering.** The right fix: emit static HTML per route at build time.
  Since all content is known at build time (it's globbed from `content/`),
  this is very doable — a prerender pass in the Vite build, or eventually
  migrating the shell to a static-first framework. This is the single
  highest-leverage dev task on the [roadmap](/roadmap).
- **`sitemap.xml`** listing every review, guide, and page URL — also derivable
  from `content/` at build time. Submit it in Search Console.
- **Open Graph / Twitter / Pinterest Rich Pin meta tags** per page — without
  prerendering these are invisible to crawlers, which is another reason
  prerendering is the keystone task.
- **Search Console + Bing Webmaster Tools** from day one, even with no
  traffic: the query data (what we *almost* rank for) is next quarter's
  content list.

## The publishing rhythm and the flat months

- **Cadence beats volume:** one genuinely good piece a week, every week.
- **30–50 solid pieces** is roughly the mass where a niche site starts being
  taken seriously by search engines.
- Expect **months of near-zero search traffic.** This is the phase where most
  sites quit. Pinterest usually shows signs of life first (weeks, not months) —
  which is exactly why we bother with it.
- Every month, **update one old piece** — freshness plus depth on existing
  URLs often beats a new URL.

> The whole game: stay narrow, publish weekly, prove first-hand experience,
> and still be here in twelve months.
