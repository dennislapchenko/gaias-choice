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
  camper family itself is **real** (Lidia & Denis, baby, two Basenjis — verified
  facts in `context/persona-context.md`, "The family — real biography"); what's
  banned is embellishing beyond those facts: invented timelines ("seven months
  on the road"), invented scenes, or gear experiences the owners haven't
  reported. Write only what they actually did; when a fact is missing, ask.
- **Plain, warm, unhyped.** No "game-changer", no exclamation-mark stacking.
  The brand is "buy less, buy better".
- **Russian content speaks in the author's voice.** Before writing or
  rephrasing anything in `content/locales/ru/`, read
  `context/persona-context.md` (voice DNA + register-calibration table + the
  5-question test) — RU text must sound like her, within the rules above.
- **Worldview for guides/Compass courses and article suggestions:** draw from
  `context/ideology-context.md` (Health: Chek, Asprey · Worldview: Buhner,
  Daragan, Ralston · Children: Steiner, Swan; extensible). Sections are domains
  of authority: Health governs food/consumption claims; Children leads on
  anything child-related. Ideology shapes framing and topic selection — never
  fabricated claims; truth-first stays senior.

## Add a product review → `content/locales/en/products/<slug>.md`

```markdown
---
title: Product Name
category: Sleep            # Sleep | Feeding | Care | Kitchen | Travel (filter chips on /reviews)
rating: 4                  # 0–5 stars; a 5 must survive the "no flaws?" test
price: "$28"               # optional; always quote it
# affiliateUrl: "https://…"   # ONLY once enrolled in the program — never a placeholder
excerpt: One honest sentence a friend would text you about it.
image: /images/review-<slug>.svg # optional; mandala art by default (see Images below)
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

## Add a guide → `content/locales/en/guides/<epic-tag>/<slug>.md`

Frontmatter: `title`, `excerpt`, `date`, optional `image`, `tags`, optional
`chapter: N` (course order — see below). The `<epic-tag>` subfolder (e.g.
`guides/homeopathy/`) is just filesystem tidiness — a guide's epic is decided
by its first tag, not by which folder the file sits in.

The **founder guides** (internal playbooks, deliberately public) form the
5-chapter epic «Честный сайт с нуля» / "An honest site from zero" (tag
`founder-guide`, `chapter:` 1–5, Gate 1 / Path 2–4 / Summit 5 — a sanctioned
5-chapter deviation from the 11-chapter format; plan and continuity map in
`context/course-plan-building-in-public.md`). Each chapter opens with a Trail
block followed by the one-line founder note:

```markdown
> **Founder guide.** Written for ourselves while we bootstrap this site —
> honest notes, published as a course.
```

Adding a founder guide means renumbering the course — extend the course plan
first. Reader-facing guides (post-bootstrap) drop the founder note and follow
the voice rules above. Don't "fix" founder guides into consumer content —
retelling each chapter from lived experience is a deliberate roadmap
milestone.

**11-chapter epic courses (Learn):** a course = 11 guide files per locale with
`chapter: N` frontmatter (1–11, controls order) and the epic tag first in
`tags`, plus a `site.yaml` `epics:` entry in both locales. The complete
authoring blueprint — 20/80 curriculum architecture (Gate / Path / Summit),
the Thread navigation weave (Trail block, spine artifact, callbacks/seeds,
Bridge block), chapter anatomy, practice-task rules, and shipping checklist —
lives in `context/epic-writing-context.md`. **Read it before writing or
editing any course chapter**; its skeleton headings feed the chapter TOC
sidebar, so don't rename them casually. Three courses exist: the founder
course (5 chapters, complete — `context/course-plan-building-in-public.md`)
and two reader-facing 11-chapter courses (ch. 1–3 shipped 2026-07-05,
ch. 4–11 pending) with outlines — chapter one-liners, named concepts, seeds,
reuse maps — in `context/course-plan-homeopathy.md` and
`context/course-plan-herbalism.md`; follow the plan when writing the next
chapter. Frontmatter gotcha learned the hard way: **quote any `title:`/`excerpt:`
containing a colon** — an unquoted `… вечером: ваш …` is a YAML nested-mapping
error that blanks the whole SPA (the `import.meta.glob` parse happens at
runtime for every page).

## Visuals inside guides (tables, diagrams, charts) — the house pattern

Every course chapter should carry 1–3 visuals that cement its concepts (added
across all 22 guide files 2026-07-05). Two building blocks, both authored
directly in the markdown — no images, no new deps:

- **GFM tables** for comparisons and reference grids (`gfm: true` is on;
  styled via `.prose table` in `styles.css`, horizontal-scroll on ≤720px).
- **Inline SVG figures** for flows, maps, charts, staircases, compasses:

  ```html
  <figure class="diagram">
  <svg viewBox="0 0 640 240" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="…">
  …
  </svg>
  <figcaption>One caption line — adds something, never repeats adjacent prose.</figcaption>
  </figure>
  ```

Rules learned the hard way:

- **No blank lines inside the `<figure>` block** — a blank line ends the
  markdown HTML block and the rest gets re-parsed as markdown. Blank line
  before and after the block, none within.
- **Colors are CSS variables only** (`var(--mint)`, `var(--sage)`,
  `var(--on-accent)`, `var(--ink)`, `var(--muted)`, `var(--line)`,
  `var(--sand-2)`, `var(--clay)`) so every palette themes the diagram. Accent
  boxes = `--sage` fill + `--on-accent` text; warning accents = `--clay`.
- **viewBox width 640**, text 11–15px at that scale; `font-family` inherits
  via `.prose figure.diagram svg`. Arrowhead `<marker>` ids must be unique
  per figure on a page (e.g. `arr-map`, `arr-ops`) — ids are document-global.
- **Give every svg `role="img"` + a real `aria-label`** describing the
  content (localized).
- **Text length is the failure mode:** RU labels run long; keep boxes roomy
  or split lines. After editing any SVG text, run the **overflow audit** in a
  served `dist/` (browser console, per guide page):

  ```js
  document.querySelectorAll('.prose figure.diagram svg').forEach((svg,i) => {
    const vb = svg.viewBox.baseVal;
    svg.querySelectorAll('text').forEach(t => { if (t.getAttribute('transform')) return;
      const b = t.getBBox();
      if (b.x < vb.x - 1 || b.x + b.width > vb.x + vb.width + 1)
        console.warn(`svg${i} overflow:`, t.textContent, Math.round(b.x), Math.round(b.width)); });
  });
  ```
- Truth-first applies to visuals: charts are qualitative shapes of claims the
  prose already makes ("not a forecast — the shape of the game"), never
  invented data points.

### Patching all locales fast (the mirroring workflow)

EN and RU guide files share the same slug and the same `##` heading skeleton,
and the house SVG pattern keeps **structure identical across locales — only
`<text>` content, `aria-label`, table cells, and `figcaption` differ.** So:

- **Change with no text in it** (SVG geometry, coordinates, colors, an image
  ref, frontmatter): apply to `en`, then apply the *identical* edit to the
  `ru` file at the same anchor (same heading / same SVG element). Pure
  copy-paste; no translation pass needed — this is deliberately fast.
- **Change with text in it:** same anchors, but labels/captions get written
  per locale (RU in her voice — persona-context). Budget for it; there's no
  shortcut, and that's fine.
- **Verify parity** after any cross-locale patch (counts must match pairwise):

  ```bash
  cd content/locales && for f in $(cd en && find guides -name '*.md'); do
    printf '%-58s fig %s/%s tbl %s/%s\n' "$f" \
      $(grep -c 'figure class="diagram"' "en/$f") $(grep -c 'figure class="diagram"' "ru/$f") \
      $(grep -c '^|' "en/$f") $(grep -c '^|' "ru/$f"); done
  ```

## Add a standalone page → `content/locales/en/pages/<slug>.md` (+ wiring)

Pages are the one content type needing code wiring:

1. Create `content/locales/en/pages/<slug>.md` with frontmatter `title: …`.
2. Add a route in `src/App.tsx`:
   `<Route path="/<slug>" element={<MarkdownPage slug="<slug>" />} />`
3. Link it: primary nav → `nav:` in `content/locales/en/site.yaml`; secondary/legal →
   `footerNav:` in `site.yaml` (rendered as internal `<Link>`s in the footer).
   Keep the primary nav short — legal/meta pages belong in the footer.

Existing pages: `about`, `contact`, `roadmap`, `disclosure`, `privacy`.

## The roadmap (`content/locales/en/pages/roadmap.md`)

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

Two paths, depending on the image:

- **Real photos** (PNG/JPG): drop into `public/images/`, run `task images`
  (containerized ImageMagick → WebP, max 1400px, q80, deletes originals), then
  set frontmatter `image: /images/<name>.webp` by hand — the task doesn't
  rewrite references.
- **Mandala art** (guide chapters and product reviews): a generated
  radial-symmetry SVG — see the "Mandala SVG art" entry in `references/development.md`
  for how to add/regenerate one. This is the default for both guides and
  reviews today; real product photos (owners' hands in frame) replace review
  mandalas per the launch checklist when they exist.

## Compliance quick-reference

- Footer already carries a short affiliate notice linking to `/disclosure`.
- Amazon Associates' required sentence sits commented-out in
  `content/locales/en/pages/disclosure.md` — uncomment when (and only when) enrolled.
- A review with an `affiliateUrl` should state the affiliate relationship
  before the first link (the site-wide footer covers the minimum, but
  per-review is the house standard).
- `content/locales/en/pages/privacy.md` promises it gets updated *before* analytics or a
  newsletter ship — honor that ordering.
