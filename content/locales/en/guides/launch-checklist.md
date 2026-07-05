---
title: "The Launch Checklist"
excerpt: Everything that must be true before we call this site launched — identity, content, legal pages, measurement, and distribution.
image: /images/guide-toddler-checklist.webp
date: 2026-07-01
tags: [founder-guide, launch, checklist]
---

> **Founder guide.** Written for us while we bootstrap the site — see the
> [Kickstart Playbook](/guides/kickstart-playbook) for context.

"Launched" doesn't mean deployed — the site already deploys. Launched means a
stranger can land here, believe us, and nothing embarrasses us or violates a
program's terms. Work through this top to bottom.

## 1. Identity & truth

- [ ] Retell **About** in our own words — the facts there are real now (the
      camper, the baby, the dogs), but the telling is still a drafted skeleton.
      Our voice, our details, nothing we haven't lived.
- [ ] Decide the public identity: names? faces? a family pseudonym? (Real
      names and faces convert trust better; decide once, early.)
- [ ] Update `site.yaml`: real `contactEmail`, real social URLs (or remove the
      social links until they exist — placeholder links to `pinterest.com`
      look broken).

## 2. Content

- [ ] **10 real reviews** written per the
      [review process](/guides/writing-reviews-that-earn-trust) — products we
      own, our photos, honest flaws.
- [ ] **Every placeholder review deleted.** No fake `affiliateUrl` anywhere
      (grep for `EXAMPLE`).
- [ ] **Replace all AI placeholder images** with our own photos (`task images`
      optimizes them; update frontmatter paths).
- [ ] 2–3 reader-facing guides rewritten from real experience (the current
      founder guides get replaced gradually — that's fine, they're honest
      about what they are).

## 3. Domain & plumbing

- [ ] Buy the domain; set up Cloud Run domain mapping (steps in README).
- [ ] Real mailbox on the domain (`hello@…`) — affiliate programs check this.
- [ ] Favicon, and a proper social-preview image once prerendering exists.

## 4. Legal & program compliance

- [ ] [Disclosure page](/disclosure) live and linked in the footer *(done —
      review wording when joining each program, e.g. Amazon's required
      sentence)*.
- [ ] [Privacy page](/privacy) live and accurate about what we collect
      *(done — update it when analytics or a newsletter appears)*.
- [ ] Per-review disclosure line appears before the first affiliate link.

## 5. Measurement

- [ ] **Google Search Console** verified, sitemap submitted (sitemap is a dev
      task on the [roadmap](/roadmap)).
- [ ] Privacy-friendly analytics — a cookieless option (Plausible, GoatCounter,
      or self-hosted umami) fits our privacy page and needs no consent banner.
- [ ] Decide where numbers get reviewed (a monthly 30-minute "what's working"
      sit-down beats daily dashboard-staring).

## 6. Distribution

- [ ] Pinterest **business** account, boards matching our categories, first
      pins for every published piece.
- [ ] Email capture decision: hosted (Kit/MailerLite free tier) vs self-hosted
      (Listmonk / tiny custom service). Even a "coming soon" signup beats
      nothing — the list is the only audience we'll ever own.
- [ ] Tell people we actually know. The first ten readers should be friends
      who'll say what's confusing.

## 7. The soft-launch test

Before announcing anywhere public, both of us click through the entire site on
a phone and ask, for every page: *"Would I trust this if a stranger made it?"*
Anything that fails gets fixed or deleted. Then we launch — quietly, and let
the weekly rhythm from the [playbook](/guides/kickstart-playbook) take over.
