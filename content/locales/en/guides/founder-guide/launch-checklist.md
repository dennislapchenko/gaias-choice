---
title: "The Launch Checklist"
excerpt: Everything that must be true before we call this site launched — identity, content, legal pages, measurement, and distribution.
image: /images/guide-toddler-checklist.svg
date: 2026-07-01
chapter: 5
tags: [founder-guide, launch, checklist]
---

> **Chapter 5 of 5 · The Summit** — [← Chapter 4: How This Site Will Make Money](/guides/how-this-site-will-make-money)
> *You already can:* build trust one review at a time, bring the right readers to it, and do the money math without romance.
> *This chapter adds:* no new fundamentals — the Summit makes everything from chapters 1–4 true at the same time, on one page.

> **Founder guide.** Written for ourselves while we bootstrap this site —
> honest notes, published as a course.

"Launched" doesn't mean deployed — the site already deploys. Launched means a
stranger can land here, believe us, and nothing embarrasses us or violates a
program's terms. This checklist is the whole course compressed: section 1 is
chapter 1's literal-truth rule made checkable, section 2 is chapter 2's craft,
sections 5–6 serve chapter 3's channels, and section 4 guards chapter 4's
programs. Work through it top to bottom.

<figure class="diagram">
<svg viewBox="0 0 640 290" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Six checklist sections — identity and truth, content, domain and plumbing, legal and compliance, measurement, distribution — all feed one gate: the soft-launch test, would I trust this if a stranger made it; only then, launch">
<defs><marker id="arr-gate" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="var(--muted)"/></marker></defs>
<rect x="16" y="20" width="192" height="44" rx="10" fill="var(--mint)"/>
<text x="112" y="47" text-anchor="middle" font-size="13" fill="var(--ink)">1 · Identity &amp; truth</text>
<rect x="16" y="76" width="192" height="44" rx="10" fill="var(--mint)"/>
<text x="112" y="103" text-anchor="middle" font-size="13" fill="var(--ink)">2 · Content</text>
<rect x="224" y="20" width="192" height="44" rx="10" fill="var(--peach)"/>
<text x="320" y="47" text-anchor="middle" font-size="13" fill="var(--ink)">3 · Domain &amp; plumbing</text>
<rect x="224" y="76" width="192" height="44" rx="10" fill="var(--peach)"/>
<text x="320" y="103" text-anchor="middle" font-size="13" fill="var(--ink)">4 · Legal &amp; compliance</text>
<rect x="432" y="20" width="192" height="44" rx="10" fill="var(--lilac)"/>
<text x="528" y="47" text-anchor="middle" font-size="13" fill="var(--ink)">5 · Measurement</text>
<rect x="432" y="76" width="192" height="44" rx="10" fill="var(--lilac)"/>
<text x="528" y="103" text-anchor="middle" font-size="13" fill="var(--ink)">6 · Distribution</text>
<line x1="112" y1="120" x2="240" y2="160" stroke="var(--muted)" stroke-width="2" marker-end="url(#arr-gate)"/>
<line x1="320" y1="120" x2="320" y2="158" stroke="var(--muted)" stroke-width="2" marker-end="url(#arr-gate)"/>
<line x1="528" y1="120" x2="400 " y2="160" stroke="var(--muted)" stroke-width="2" marker-end="url(#arr-gate)"/>
<rect x="150" y="166" width="340" height="66" rx="12" fill="var(--sage)"/>
<text x="320" y="193" text-anchor="middle" font-size="14" font-weight="700" fill="var(--on-accent)">7 · The soft-launch test</text>
<text x="320" y="215" text-anchor="middle" font-size="12.5" font-style="italic" fill="var(--on-accent)">"Would I trust this if a stranger made it?"</text>
<line x1="320" y1="232" x2="320" y2="258" stroke="var(--muted)" stroke-width="2" marker-end="url(#arr-gate)"/>
<text x="336" y="278" text-anchor="middle" font-size="13.5" font-weight="700" fill="var(--ink)">launch — quietly</text>
</svg>
<figcaption>Six sections, one exam. A page that fails the stranger test gets fixed or deleted — the gate doesn't argue.</figcaption>
</figure>

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

This is the course's final exam — chapter 1 promised a site built on nothing
but the literal truth, and this walk-through grades it. Before announcing
anywhere public, both of us click through the entire site on a phone and ask,
for every page: *"Would I trust this if a stranger made it?"* Anything that
fails gets fixed or deleted. Then we launch — quietly, and let the weekly
rhythm from [chapter 1](/guides/kickstart-playbook) take over.

## Now you can

- Audit any review site — including this one — against the launch bar, section
  by section.
- Say what "launched" means here, and what it deliberately does not mean.
- Grade the artifact against chapter 1's promise: trust first, traffic after,
  nothing that isn't literally true.

## Check yourself

Answer from memory:

1. Which items must be finished before applying to any affiliate program?
2. What is the one question of the soft-launch test, and what happens to a
   page that fails it?
3. Why does "launched" not mean "deployed"?

## Next

Beyond the Summit there is no chapter — there's the site itself. When this
checklist is green, the course retires the way chapter 1 promised: each
founder guide retold from lived experience, placeholder by placeholder. The
weekly rhythm takes over from here; watch it happen on the
[Roadmap](/roadmap).
