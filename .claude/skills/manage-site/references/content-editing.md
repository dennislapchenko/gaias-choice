# Content editing — Gaia's Choice

Everything editable lives in `content/`. Filenames are URL slugs (renaming a
file changes its URL). Collections sort by `date` descending — the date you
pick controls list position. Markdown is GFM (task-list checkboxes render).

## Voice and standards (applies to every piece)

- **Verdict first.** The reader who leaves after ten seconds still gets the
  answer. Then evidence, then story.
- **Concrete beats adjectives.** "Survived 14 machine washes without pilling"
  not "very durable". Measured grams, counted washes, real prices.
- **Every review names a flaw.** A flawless 5-star review reads as an ad. If
  nothing else, the flaw is the price or who it's *not* for.
- **Nothing fictional.** No invented experience, durations, or anecdotes. The
  old placeholder content pretended to be a family with "7 months in a camper" —
  that persona is banned. Write only what the owners actually did.
- **Plain, warm, unhyped.** No "game-changer", no exclamation-mark stacking.
  The brand is "buy less, buy better".

## Add a product review → `content/products/<slug>.md`

```markdown
---
title: Product Name
category: Sleep            # Sleep | Feeding | Care | Kitchen | Travel (filter chips on /reviews)
rating: 4                  # 0–5 stars; a 5 must survive the "no flaws?" test
price: "$28"               # optional; always quote it
# affiliateUrl: "https://…"   # ONLY once enrolled in the program — never a placeholder
excerpt: One honest sentence a friend would text you about it.
image: /images/<slug>.webp # optional; owners' own photo (see Images below)
date: 2026-07-05           # today; controls ordering
tags: [organic, cotton]    # optional
---

**Verdict:** …

## How we tested it
(how long, conditions, bought vs gifted — gifted must be disclosed here)

## What's genuinely good

## What we'd change

## Who it's for
```

Ask for real testing notes if the user didn't provide them. Structure sections
may flex, but verdict-first + a flaws section are fixed.

## Add a guide → `content/guides/<slug>.md`

Frontmatter: `title`, `excerpt`, `date`, optional `image`, `tags`.

Current guides are **founder guides** (internal playbooks, deliberately
public). If adding another founder guide, open with the same blockquote the
existing ones use:

```markdown
> **Founder guide.** Written for us while we bootstrap the site — see the
> [Kickstart Playbook](/guides/kickstart-playbook) for context.
```

Reader-facing guides (post-bootstrap) drop that note and follow the voice
rules above. Don't "fix" founder guides into consumer content — replacing them
is a deliberate roadmap milestone.

## Add a standalone page → `content/pages/<slug>.md` (+ wiring)

Pages are the one content type needing code wiring:

1. Create `content/pages/<slug>.md` with frontmatter `title: …`.
2. Add a route in `src/App.tsx`:
   `<Route path="/<slug>" element={<MarkdownPage slug="<slug>" />} />`
3. Link it: primary nav → `nav:` in `content/site.yaml`; secondary/legal →
   `footerNav:` in `site.yaml` (rendered as internal `<Link>`s in the footer).
   Keep the primary nav short — legal/meta pages belong in the footer.

Existing pages: `about`, `contact`, `roadmap`, `disclosure`, `privacy`.

## The roadmap (`content/pages/roadmap.md`)

Public, building-in-public, phased with `- [ ]` checkboxes. Maintenance rules:

- Tick items when milestones actually land; never pre-tick.
- New scope goes into the matching phase; don't create Phase 5 lightly.
- Update the "*Last updated: <Month Year>*" footer line on every edit.

## site.yaml

Site name, tagline, description, mission, `values`, `nav`, `footerNav`,
`social`, `contactEmail`, `heroImage`. The description/values are public
claims — keep them literally true (no fabricated credentials). `social` URLs
and `contactEmail` are still placeholders; updating them is a Phase 0 roadmap
item.

## Images

Drop PNG/JPG into `public/images/`, run `task images` (containerized
ImageMagick → WebP, max 1400px, q80, deletes originals), then set frontmatter
`image: /images/<name>.webp` by hand — the task doesn't rewrite references.
Current images are AI placeholders; real product photos (owners' hands in
frame) replace them per the launch checklist.

## Compliance quick-reference

- Footer already carries a short affiliate notice linking to `/disclosure`.
- Amazon Associates' required sentence sits commented-out in
  `content/pages/disclosure.md` — uncomment when (and only when) enrolled.
- A review with an `affiliateUrl` should state the affiliate relationship
  before the first link (the site-wide footer covers the minimum, but
  per-review is the house standard).
- `content/pages/privacy.md` promises it gets updated *before* analytics or a
  newsletter ship — honor that ordering.
