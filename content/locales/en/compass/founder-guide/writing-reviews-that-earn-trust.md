---
title: "Writing Reviews That Earn Trust (The Process)"
excerpt: The testing process, the review structure, and the exact template to use — so every review is one you could defend to a reader's face.
image: /images/guide-natural-vs.svg
date: 2026-07-04
chapter: 2
tags: [founder-guide, reviews, process]
---

> **Chapter 2 of 5 · The Path** — [← Chapter 1: The Kickstart Playbook](/compass/kickstart-playbook) · [Chapter 3: Getting Traffic →](/compass/getting-traffic-seo-and-pinterest)
> *You already can:* name the two assets and the order of operations they dictate.
> *This chapter adds:* the testing bar, the review structure, and the template that turn honesty into a repeatable craft.

A review site lives or dies on one question: *does the reader believe you
actually used this thing?* This is the trust half of chapter 1's two assets —
the one that has to come first — turned into a repeatable process. Everything
in this chapter exists to make the honest answer "yes" — and to make that
obvious on the page.

One boundary before the rules, because chapter 1 drew it and this chapter
enforces it: everything below governs **reviews** — the pages that claim
lived use. The Compass courses make a different claim and live by the
provenance rule instead — they say openly what they are, including the
ones drafted with an LLM. The only door a product has into a course is the
one rule 1 leaves open: named as "we haven't tried this", never rated.

## The rules

1. **Never review a product you haven't used.** No exceptions, not even
   "roundup" listicles. An unused product can appear in a guide labeled "we
   haven't tried this" — clearly marked — but never with a rating.
2. **Buy with your own money where possible.** If a brand sends a free unit,
   the review says so in the first section, and the brand gets no copy approval.
3. **Every review names a flaw.** A 5-star review with no "what we'd change"
   section reads as an ad. If you truly can't find a flaw, the flaw is the price
   or who it's *not* for.
4. **Photos are yours.** Phone camera is fine. Your hands, your floor, your baby's
   crib in the background. Original photos are the single strongest signal — to
   readers and to Google — that the experience is real. Why Google in
   particular rewards them so heavily is chapter 3's story.

## The testing process (minimum bar)

Before a product earns a review:

- **Two weeks of normal use** minimum; a month for sleep and feeding gear.
- **Wash/clean it** the way a real family would, at least three times. Half of
  "natural" gear fails at the laundry stage — shrinking, pilling, retaining smells.
- **Check the claims.** "Organic cotton" — is there a GOTS or OEKO-TEX label,
  and does the certificate number check out on the certifier's site? "Plastic-free" —
  including the lid gasket, the coating, the shipping packaging?
- **Note actual numbers.** Weight on your kitchen scale, measured dimensions,
  how many milliliters it really holds. Concrete numbers nobody else bothered
  to measure are what make a review quotable and rankable.

The bar at a glance:

| | Minimum | What it catches |
|---|---|---|
| **Use** | 2 weeks; a month for sleep & feeding gear | how it behaves in a real family day |
| **Washing** | 3 real washes | shrinking, pilling, retained smells |
| **Claims** | certificate number verified with the certifier | "organic" and "plastic-free" that aren't |
| **Numbers** | weighed and measured by you | the figures nobody else publishes |

Keep raw notes per product in a plain text file from day one. The review is the
notes, cleaned up.

## The structure every review follows

Readers skim. Put the answer first and the story later:

1. **Verdict up top** — two or three sentences: what it is, who should buy it,
   who shouldn't. A reader who leaves after ten seconds should still get the answer.
2. **How we tested** — how long, in what conditions, bought or gifted.
3. **What's genuinely good** — specifics, not adjectives. "Survived 14 machine
   washes without pilling" beats "very durable."
4. **What we'd change** — the honest flaws section. This is the trust engine.
5. **Who it's for / alternatives** — including cheaper or simpler options, even
   when they earn you nothing. *Especially* then.

```diagram review-anatomy
aria: "Anatomy of a review page, top to bottom: verdict first, how we tested, what's genuinely good, what we'd change, who it's for and alternatives"
t1: "Verdict"
t2: "the answer, in the first ten seconds"
t3: "How we tested"
t4: "What's genuinely good"
t5: "What we'd change"
t6: "the trust engine"
t7: "Who it's for / alternatives"
t8: "skimmers stop here —"
t9: "and still get the answer"
t10: "a review without"
t11: "this section"
t12: "reads as an ad"
caption: "Every review, same skeleton: answer first, evidence after, flaws on the record."
```

## The template

Copy this into `content/products/<slug>.md` and fill it in:

```markdown
---
title: Product Name
category: Sleep            # Sleep | Feeding | Care | Kitchen | Travel
rating: 4                  # 0–5; a 5 must survive the "no flaws?" test
price: "€28"
# affiliateUrl: add ONLY after joining the program — never a placeholder
excerpt: One honest sentence a friend would text you about it.
image: /images/<slug>.webp # your own photo, optimized via `task images`
date: 2026-07-05
tags: [organic, cotton]
---

**Verdict:** …

## How we tested it

## What's genuinely good

## What we'd change

## Who it's for
```

## Disclosure

Any page with affiliate links states it plainly *before* the first link — the
site footer and the [disclosure page](/disclosure) carry the full version. This
is an FTC requirement, an affiliate-program requirement, and more importantly
the same honesty the whole site is built on.

## The cleanup task

Every existing review on this site is placeholder text with fake affiliate
links. As real reviews get written, the fakes get deleted — not edited into
shape, deleted. That's chapter 1's literal-truth rule with a broom in its
hands. Track the swap on the [roadmap](/roadmap).

## Practice

With the product from chapter 1's notes file — 30–40 minutes:

1. Run the claims check today: find the certification label, verify its number
   on the certifier's site, and write down what you actually find.
2. Measure one thing about it nobody publishes — weight, real volume,
   dimensions — and add the number to the notes.
3. Draft the verdict: two or three sentences, including who it's *not* for.

**How to know it worked:** a stranger reading only your verdict could decide
to buy or skip in ten seconds.

## Now you can

- Say which products may never receive a rating, and what a free unit from a
  brand changes.
- Run the minimum testing bar: two weeks of use, three washes, verified
  claims, real numbers.
- Build a review verdict-first and defend the flaws section as the trust
  engine, not a courtesy.

## Check yourself

Answer from memory:

1. What are the four rules — and which one is the strongest signal to readers
   and Google alike?
2. Name the five sections of the review structure, in order.
3. Why does a flawless 5-star review damage trust instead of building it?

## Next

A perfect review nobody reads builds nothing. Chapter 3 is the other asset:
how people actually find a site like this, why Pinterest fits the niche
unusually well, and the flat months every honest site walks through.

**[Chapter 3: Getting Traffic →](/compass/getting-traffic-seo-and-pinterest)**
