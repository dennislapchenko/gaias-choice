---
title: "Writing Reviews That Earn Trust (Our Process)"
excerpt: The testing process, the review structure, and the exact template we use — so every review is one we could defend to a reader's face.
image: /images/guide-natural-vs.webp
date: 2026-07-04
tags: [founder-guide, reviews, process]
---

> **Founder guide.** Written for us while we bootstrap the site — see the
> [Kickstart Playbook](/guides/kickstart-playbook) for context.

A review site lives or dies on one question: *does the reader believe we
actually used this thing?* Everything in this guide exists to make the honest
answer "yes" — and to make that obvious on the page.

## The rules

1. **We never review a product we haven't used.** No exceptions, not even
   "roundup" listicles. An unused product can appear in a guide as "we haven't
   tried this" — clearly labeled — but never with a rating.
2. **We buy with our own money where possible.** If a brand sends a free unit,
   the review says so in the first section, and the brand gets no copy approval.
3. **Every review names a flaw.** A 5-star review with no "what we'd change"
   section reads as an ad. If we truly can't find a flaw, the flaw is the price
   or who it's *not* for.
4. **Photos are ours.** Phone camera is fine. Our hands, our floor, our baby's
   crib in the background. Original photos are the single strongest signal — to
   readers and to Google — that the experience is real.

## The testing process (minimum bar)

Before a product earns a review:

- **Two weeks of normal use** minimum; a month for sleep and feeding gear.
- **Wash/clean it** the way a real family would, at least three times. Half of
  "natural" gear fails at the laundry stage — shrinking, pilling, retaining smells.
- **Check the claims.** "Organic cotton" — is there a GOTS or OEKO-TEX label,
  and does the certificate number check out on the certifier's site? "Plastic-free" —
  including the lid gasket, the coating, the shipping packaging?
- **Note actual numbers.** Weight on our kitchen scale, measured dimensions,
  how many milliliters it really holds. Concrete numbers nobody else bothered
  to measure are what make a review quotable and rankable.

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
   when they earn us nothing. *Especially* then.

## The template

Copy this into `content/products/<slug>.md` and fill it in:

```markdown
---
title: Product Name
category: Sleep            # Sleep | Feeding | Care | Kitchen | Travel
rating: 4                  # 0–5; a 5 must survive the "no flaws?" test
price: "$28"
# affiliateUrl: add ONLY after joining the program — never a placeholder
excerpt: One honest sentence a friend would text you about it.
image: /images/<slug>.webp # our own photo, optimized via `task images`
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
shape, deleted. Track the swap on the [roadmap](/roadmap).
