---
title: "How This Site Will Make Money (Honest Math Included)"
excerpt: Affiliate programs, realistic commission math, what comes after affiliates — and the traps that get new sites banned.
image: /images/guide-toiletries.webp
date: 2026-07-03
tags: [founder-guide, monetization, affiliate]
---

> **Founder guide.** Written for us while we bootstrap the site — see the
> [Kickstart Playbook](/guides/kickstart-playbook) for context.

Monetization is the *last* step in the chain, not the first. Nothing here works
without content and traffic. But we should understand the destination before we
start walking.

## Layer 1: Affiliate links (months 3–12)

An affiliate link carries a tracking tag; if a reader clicks it and buys, the
shop pays us a percentage. The reader pays nothing extra.

### Amazon Associates — the default starting point

Almost everything we review is on Amazon, approval is easy, and one link
monetizes an entire cart (if a reader clicks our swaddle link and also buys a
stroller, both count).

The rules that actually bite:

- **Three qualifying sales in the first 180 days** or the account is closed
  (we can reapply — but better to join only when there's traffic to convert).
- **Mandatory wording:** "As an Amazon Associate we earn from qualifying
  purchases" — visible on the site. Goes on our [disclosure page](/disclosure)
  and footer.
- **No link cloaking or URL shorteners**, no links in emails or PDFs, no
  quoting prices as if static (they change). The program bans first and asks
  never.
- **Session window is short** (~24 hours; longer if the item was added to
  cart). This is normal — volume is the game.
- Commission rates are per-category and change; baby-adjacent categories have
  been in the **~3%** range. Always check the current rate card rather than
  trusting a blog post — including this one.

### Beyond Amazon — where the eco niche actually pays

Small natural-goods brands often pay **8–15%** through affiliate networks,
because they can't outspend Amazon on anything except commission. Once we have
~10 real reviews and some traffic:

- **Networks to check:** Awin (absorbed ShareASale), impact.com, AvantLink
  (strong in outdoor/travel gear). One application per network unlocks many
  brands.
- **Brand-direct programs:** many eco baby brands (organic textiles, castile
  soap makers, stainless bottle brands) run their own programs — look for an
  "Affiliates" link in their site footer, or just email them. A small brand
  will happily do 10% + a discount code for our readers.
- **Rule of thumb:** review the product first, join its program second. Never
  the reverse — that ordering is what keeps the reviews honest.

### The honest math

Assume a review page converts like a typical honest affiliate page:

| | Amazon (~3%) | Eco brand (~10%) |
|---|---|---|
| Product price | $30 | $30 |
| Commission per sale | ~$0.90 | ~$3.00 |
| Sales needed for $300/mo | ~333 | ~100 |

Two conclusions fall out of that table:

1. **Low-ticket items need serious traffic.** A $12 soap review is trust-building
   content, not income content.
2. **A handful of well-chosen higher-ticket reviews** (a $250 travel crib, a
   $150 merino sleep bundle) carry the revenue. The packing lists and $12 soaps
   bring the readers; the crib review pays the hosting.

Realistic expectation: **$0 for the first several months.** A niche site doing
things right typically sees first affiliate income around month 4–6 and
meaningful income ($500+/mo) somewhere in year one-to-two. Anyone promising
faster is selling a course.

## Layer 2: What comes after affiliates

Not now — but the roadmap should point here:

- **Digital products.** Our checklists and packing lists as beautiful printable
  PDFs — $5–9, no inventory, 100% margin, and this niche *loves* printables.
  A free one-pager doubles as the email-list magnet.
- **Email list.** The only audience we own. Start collecting early — even a simple
  "new reviews, monthly" newsletter. Every future revenue layer multiplies
  through it. (Dev note: we can self-host — Listmonk, or a tiny custom
  service — instead of paying ConvertKit; a backend is our cheap superpower.)
- **Display ads — later, maybe never.** Premium networks gate hard (Mediavine
  historically ~50k sessions/month; Raptive ~100k pageviews). AdSense before
  that earns pennies and uglifies the site. Ads also sit oddly with a
  "buy less, buy better" brand — decide when it's a real decision.
- **Sponsorships.** Once there's an audience, eco brands pay flat fees for
  honest (disclosed) reviews. Our no-copy-approval rule from the
  [review process](/guides/writing-reviews-that-earn-trust) is non-negotiable.

## The traps (each of these has killed real sites)

- **Applying to programs with placeholder content** → rejection or ban that
  follows the domain. All fake `affiliateUrl`s must be gone before we apply.
- **Skipping disclosure** → FTC problem *and* program ban. The
  [disclosure page](/disclosure) plus per-page notice handles it.
- **Letting commissions choose the products** → readers smell it, trust dies,
  and with it the whole model.
- **Measuring nothing.** (Dev note: a tiny self-hosted redirect service —
  `/go/<product>` → 302 with click counting — gives us click-through data no
  matter the program, and keeps affiliate URLs editable site-wide in one place.
  Check each program's cloaking policy first; Amazon requires the raw link.)
