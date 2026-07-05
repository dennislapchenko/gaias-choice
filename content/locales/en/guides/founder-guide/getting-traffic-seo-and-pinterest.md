---
title: "Getting Traffic: SEO, Pinterest, and Patience"
excerpt: How people will actually find this site — keyword research for beginners, why Pinterest fits this niche, and the technical SEO work our stack needs.
image: /images/guide-packing-light.svg
date: 2026-07-02
chapter: 3
tags: [founder-guide, seo, traffic]
---

> **Chapter 3 of 5 · The Path** — [← Chapter 2: Writing Reviews That Earn Trust](/guides/writing-reviews-that-earn-trust) · [Chapter 4: How This Site Will Make Money →](/guides/how-this-site-will-make-money)
> *You already can:* test a product to the minimum bar and write a verdict-first review that names its flaws.
> *This chapter adds:* keyword research without paid tools, Pinterest as a search engine, and the patience math of the flat months.

> **Founder guide.** Written for ourselves while we bootstrap this site —
> honest notes, published as a course.

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
   drawbacks, comparisons. This is where chapter 2's fourth rule — *photos are
   ours* — pays out: the
   [review process](/guides/writing-reviews-that-earn-trust) produces exactly
   this evidence, not as an SEO trick, but because the incentives align
   perfectly.
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

| The phrase | Can we rank? | Why |
|---|---|---|
| "baby bottles" | not this decade | the whole internet competes for it |
| "best glass baby bottles for travel" | someday, with mass | narrower, still crowded |
| "glass baby bottles that fit in a carry-on" | this year | specific, answerable, and genuinely ours |

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

- **Cadence beats volume:** one genuinely good piece a week, every week —
  chapter 1's weekly rhythm, seen from the traffic side.
- **30–50 solid pieces** is roughly the mass where a niche site starts being
  taken seriously by search engines.
- Expect **months of near-zero search traffic.** This is the phase where most
  sites quit. Pinterest usually shows signs of life first (weeks, not months) —
  which is exactly why we bother with it.
- Every month, **update one old piece** — freshness plus depth on existing
  URLs often beats a new URL.

<figure class="diagram">
<svg viewBox="0 0 640 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A qualitative chart of traffic over the first twelve months: Pinterest shows small life within weeks; search stays near zero for months, then compounds once thirty to fifty pieces are published; most sites quit during the flat months">
<rect x="60" y="36" width="220" height="214" rx="8" fill="var(--sand-2)"/>
<text x="170" y="196" text-anchor="middle" font-size="12" font-style="italic" fill="var(--muted)">the flat months —</text>
<text x="170" y="212" text-anchor="middle" font-size="12" font-style="italic" fill="var(--muted)">where most sites quit</text>
<line x1="60" y1="250" x2="620" y2="250" stroke="var(--ink)" stroke-width="2"/>
<line x1="60" y1="250" x2="60" y2="30" stroke="var(--ink)" stroke-width="2"/>
<text x="340" y="278" text-anchor="middle" font-size="12.5" fill="var(--muted)">months publishing weekly →</text>
<text x="44" y="140" text-anchor="middle" font-size="12.5" fill="var(--muted)" transform="rotate(-90 44 140)">visitors</text>
<text x="160" y="266" text-anchor="middle" font-size="12" fill="var(--muted)">3</text>
<text x="300" y="266" text-anchor="middle" font-size="12" fill="var(--muted)">6</text>
<text x="460" y="266" text-anchor="middle" font-size="12" fill="var(--muted)">9</text>
<text x="606" y="266" text-anchor="middle" font-size="12" fill="var(--muted)">12</text>
<path d="M60 248 C 160 246, 260 244, 320 238 C 420 228, 520 220, 612 214" fill="none" stroke="var(--clay)" stroke-width="2.5"/>
<path d="M60 249 C 180 248, 280 247, 340 240 C 420 230, 500 160, 612 60" fill="none" stroke="var(--sage)" stroke-width="3"/>
<line x1="400" y1="250" x2="400" y2="120" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="5 5"/>
<text x="408" y="132" font-size="12" font-style="italic" fill="var(--muted)">~30–50 solid pieces:</text>
<text x="408" y="148" font-size="12" font-style="italic" fill="var(--muted)">search starts taking</text>
<text x="408" y="164" font-size="12" font-style="italic" fill="var(--muted)">the site seriously</text>
<line x1="80" y1="40" x2="112" y2="40" stroke="var(--sage)" stroke-width="3"/>
<text x="120" y="45" font-size="12.5" fill="var(--ink)">Google search</text>
<line x1="80" y1="62" x2="112" y2="62" stroke="var(--clay)" stroke-width="2.5"/>
<text x="120" y="67" font-size="12.5" fill="var(--ink)">Pinterest</text>
</svg>
<figcaption>Not a forecast — the shape of the game: Pinterest twitches first, search compounds late, and the flat months are a phase, not a verdict.</figcaption>
</figure>

One more reason patience is structural rather than decorative: joining
affiliate programs before there's traffic doesn't just earn nothing — it can
close the account for good. The exact rule, and the honest math around it, is
chapter 4.

> The whole game: stay narrow, publish weekly, prove first-hand experience,
> and still be here in twelve months.

## Practice

Fifteen minutes, for the product in your notes file:

1. Type its topic into Google; write down every autocomplete suggestion and
   "People also ask" question worth answering.
2. Look at who ranks now, and note honestly where first-hand evidence could
   win.
3. Keep the three most winnable long-tail phrases — they go to the top of the
   editorial-calendar list.

**How to know it worked:** each kept phrase is specific enough that you can
name the exact page that would answer it.

## Now you can

- Turn autocomplete and "People also ask" into demand data without paying for
  a tool.
- Say why thirty pieces on one narrow topic beat three hundred scattered ones.
- Treat Pinterest as a search engine: business account, category boards, tall
  pins to specific pages.
- Name the technical SEO gap of an SPA and its keystone fix.

## Check yourself

Answer from memory:

1. In what order of importance do the traffic channels come — and which ones
   are deliberately optional?
2. Why is prerendering the keystone dev task rather than just one item on a
   list?
3. Around what content mass does a niche site start being taken seriously —
   and which channel usually shows life first while search is still flat?

## Next

Trust engine, traffic engine — now the part everyone asks about first and
should build last. Chapter 4 is the money: how affiliate income actually
works, the math with no romance in it, and the traps that have killed real
sites.

**[Chapter 4: How This Site Will Make Money →](/guides/how-this-site-will-make-money)**
