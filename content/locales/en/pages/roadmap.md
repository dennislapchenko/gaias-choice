---
title: Roadmap
---

We're building Gaia's Choice in public. This is the honest state of the
project and where it's going — including the parts that aren't done yet.
The thinking behind each phase lives in our free founder course,
[An honest site from zero](/compass), starting with
[chapter 1: The Kickstart Playbook](/compass/kickstart-playbook).

Where we actually are: seven months on the road with our son, we're no longer
just travelling — we're **looking for the place to land**. We spent weeks on
permaculture farms in Portugal, saw off-grid homesteads across France and
beyond, and right now we're in Bulgaria, looking for a forest school,
like-minded people, and land of our own to grow a food forest on. That search
is the spine of everything here — and it may take a while, which is the honest
reason the reviews keep coming: we're still on the road, still testing gear,
until the road ends at a gate we plant ourselves.

Two reading rules: **months count from the first real review**, not from
today — and a phase opens only when the previous one's "done when" line is
true. One phase at a time.

The order behind the phases is deliberate: **identity → community → trust →
reviews → revenue** — each rung grows from the one below it, never the other
way around. That's why the campfire exists before the first affiliate link:
belonging is harder to copy than content.

## Phase 0 — Foundations *(now)*

**Goal: nothing on the site is fake — and the site knows who it is.**

- [x] Site scaffolding: content-driven SPA, containerized, deployable
- [x] Backend foundation: a small Go API with its own database and real
      accounts, running on a little server of its own — and the site works
      exactly the same without it. The first reader-facing piece is live:
      you can sign up from the header and take a seat around the campfire on
      the account page *(further portal features only once they exist)*
- [x] Passwordless sign-in: sign in with your Telegram username (tap our bot,
      you're in) or a one-time email link — no password to invent or forget
      *(biometric passkeys come once the site has its permanent address)*
- [x] Founder course written (playbook, reviews, traffic, money, launch)
- [x] Disclosure & privacy pages
- [x] True About page — real facts only (turns out the camper story was ours all along)
- [ ] Retell About in our own words — the facts are true, the voice isn't ours yet
- [ ] Decide the public identity once, early: names? faces? *(how much of the
      homestead dream — settled: it's the throughline, foregrounded not hidden;
      the search for land, food forests, and people to share them with is the
      story the whole site is told through)*
- [ ] The front page leads with our story — the camper, the two years of
      building, why the road — before any product. Story before methodology
- [ ] Real contact email and social accounts in `site.yaml` — or remove the
      placeholders until they exist
- [ ] Buy the first 5–10 products; start a testing-notes file for each
- [ ] Domain purchased and mapped

**Done when:** a stranger could read any page without being misled.

## Phase 1 — Real content, quiet launch *(first ~2 months)*

**Goal: 10 real reviews, zero placeholders — then launch, quietly.**

- [ ] First real review published (own product, own photos, honest flaws)
- [ ] Weekly publishing rhythm held for 8 consecutive weeks
- [ ] All placeholder reviews and AI images deleted or replaced
- [x] Reviews scored on a shared **Gaia Score** — the same few criteria for
      every product (not a lone star), so a rating means the same thing across
      the whole site *(criteria still provisional, to be finalized)*
- [ ] 10 reviews + 2–3 guides drawn from lived travel experience
- [x] Herbalism Compass course finished (all 11 chapters, both languages) —
      real content that isn't reviews
- [x] "Maybe Homeopathy" Compass course finished (all 11 chapters, both
      languages) — with a situation table for real family nights (teething,
      bumps, fevers, colds) and the red flags ahead of everything else
- [ ] Pick one recurring ritual and hold it — a monthly almanac letter, a
      season-opening Journal note — something readers learn to expect. Trust
      comes from consistency, not expertise alone

**Voice track (the Compass is the only section drafted with an AI — every
other place gets our own words; About is tracked separately in Phase 0):**

- [ ] Reviews in our own words — real testing notes, not AI-drafted
- [ ] Journal entries in our own words — by hand, not AI-drafted
- [ ] Contact page in our own words
- [ ] Disclosure page in our own words
- [ ] Privacy page in our own words
- [ ] Support page intro in our own words
- [ ] This Roadmap page in our own words
- [ ] Site-wide copy in our own words — tagline, description, bio, mission,
      values, "who we respect" blurbs

**Dev track (makes the content findable):**

- [x] Per-page `<title>` + meta description *(client-side for now — the
      prerendering below will bake them into the HTML crawlers see)*
- [ ] Build-time prerendering of every route to static HTML *(keystone task —
      unlocks SEO, Open Graph previews, Pinterest Rich Pins; plan chosen, but
      waiting on our own domain first — search history should accrue to the
      permanent address, not the temporary one)*
- [ ] `sitemap.xml` generated from `content/` at build time
- [ ] Search Console verified, sitemap submitted
- [x] Privacy-friendly analytics — our own cookieless counter, no consent
      banner; [/privacy](/privacy) updated first, as promised

**Done when:** the [launch checklist](/compass/launch-checklist) is green and
the soft-launch test is passed.

## Phase 2 — Traffic *(months 3–6)*

**Goal: people we don't know read the site — and the ones who stay have a
place to sit.**

- [ ] Pinterest business account; pin templates; every piece pinned
- [ ] 25+ published pieces, still narrow, still weekly
- [ ] One old piece refreshed every month — freshness on existing URLs often
      beats a new URL
- [ ] Email capture live, even a bare signup form (dev decision: hosted free
      tier vs self-hosted Listmonk)
- [ ] First free printable as the signup magnet (a course companion checklist
      is a natural first candidate)
- [ ] Monthly metrics half-hour: Search Console queries → next month's content
      list; learn which language actually brings readers and lean that way
- [ ] Everyone who writes to us gets a real answer — and an invitation to
      take a seat at the campfire

**Done when:** 1,000 organic visits/month.

## Phase 3 — First income *(months 6–12)*

**Goal: the site pays for its own hosting, honestly.**

- [ ] Apply to affiliate programs — brands we've already reviewed first,
      then Amazon Associates *(only once traffic can produce 3 sales in 180
      days — see [chapter 4: the money math](/compass/how-this-site-will-make-money))*
- [ ] Affiliate links added to existing reviews, with per-page disclosure
- [ ] 2–3 higher-ticket reviews published (these carry the revenue math)
- [ ] Dev track: `/go/<slug>` redirect service with click counting, where
      program rules allow — one place to manage every affiliate URL

**Done when:** first commission (frame it), then a consistent $100/month.

## Phase 4 — Compounding *(year 1+)*

**Goal: every asset feeds another.** Opens only once Phase 3's line is true.

- [ ] Paid printable bundles (checklists, packing lists, course companions)
- [ ] Newsletter as a product in itself (monthly, genuinely useful)
- [ ] Direct brand partnerships (disclosed, no copy approval — ever)
- [ ] Let the almanac drive seasonal pieces — a real ephemeris is an asset no
      competitor in this niche has
- [ ] Annual transparency report — what we earned, what share came from
      affiliate links, which recommendations we got wrong, what we pulled.
      Almost nobody publishes one; that's exactly why trust compounds from it
- [ ] Decide on display ads *(probably not — sits badly with "buy less")*
- [ ] Retire the founder course chapter by chapter, each retold from lived
      experience; archive the originals in a "building in public" corner
- [ ] Readers around the campfire become contributors — their fixes, their
      routes, their testing notes, published with credit

**Done when:** it isn't — this phase is the operating state we're building
toward.

## Phase 5 — The homestead *(the horizon)*

**Goal: the site becomes what it documents.** This phase doesn't open — it
pulls. Every phase above is a step toward it, and it's the reason none of
them are allowed to cheat. It's also the search that's already live: the land
we're looking for right now is the first line of this phase, not a someday.

- [ ] **The land found** — a place in the right community (a forest school
      within reach, like-minded neighbors), where roots can actually go down.
      The search that's happening now — Bulgaria, and wherever it leads — ends
      here.
- [ ] **The circle meets off-screen** — the campfire becomes a real gathering,
      however small; the people we found online, found in person.
- [ ] **The food forest planted** — agroforests, animals, natural building. The
      site starts documenting soil and trees, not only gear.
- [ ] **A forest school and shared learning on the land** — the natural-living
      skills we teach in the Compass, practiced with other families, with kids
      in the woods.
- [ ] **Gaia's Choice retold from the land** — an operating system for family
      life, written by a family that lives it, and genuinely useful to other
      families trying to do the same.

**Done when:** the roadmap stops being about the site.

---

*Last updated: July 2026. If this page hasn't been updated in three months,
ask us why.*
