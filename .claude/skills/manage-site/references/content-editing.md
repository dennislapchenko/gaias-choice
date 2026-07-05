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
- **Worldview for Compass courses, Journal entries and article suggestions:** draw from
  `context/ideology-context.md` (Health: Chek, Asprey · Worldview: Buhner,
  Daragan, Ralston · Children: Steiner, Swan; extensible). Sections are domains
  of authority: Health governs food/consumption claims; Children leads on
  anything child-related. Ideology shapes framing and topic selection — never
  fabricated claims; truth-first stays senior.

## Add a product review → `content/locales/en/products/<slug>.md`

**The canonical scaffold is `content/shared/review-template.<locale>.md`** —
the same file the "Contribute!" button on `/reviews` copies to the clipboard
(en + ru; `getReviewTemplate` in `content.ts`). Start every review from it.
Frontmatter: `title`, `category` (must match the locale's existing category
set — the filter chips), `rating` 0–5 (a 5 must survive the "no flaws?"
test), `price` (always quoted), optional `affiliateUrl` (ONLY once enrolled —
never a placeholder), `excerpt`, optional `image` (mandala SVG by default),
`date`, optional `tags`.

The five body sections are **the universal structure of every review** — keep
them all, in this order:

1. `**Verdict:** …` — the answer first
2. `## How we tested it` — duration, conditions, bought vs gifted (gifted
   must be disclosed here)
3. `## What's genuinely good`
4. `## What we'd change` — every review names a flaw
5. `## Who it's for` — and who should skip it

To change the structure, edit the template files themselves (keep en + ru in
lockstep) — don't improvise per review. Ask for real testing notes if the
user didn't provide them.

## Add a Compass chapter → `content/locales/en/compass/<epic-tag>/<slug>.md`

> **Compass is the site's one openly computer-assisted section** — courses
> AI-drafted from the owners' context/voice, then edited, disclosed by the
> `compass.provenance` banner on `/compass`. The **Journal** (`/journal`) is the
> human-written counterpart — see "Add a Journal entry" below. (Full provenance
> contract: SKILL.md non-negotiable #6.)

Frontmatter: `title`, `excerpt`, `date`, optional `image`, `tags`, optional
`chapter: N` (course order — see below). The `<epic-tag>` subfolder (e.g.
`compass/homeopathy/`) is just filesystem tidiness — a chapter's epic is decided
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
sidebar, so don't rename them casually. Courses that exist: the founder
course and `inside-websites` (both 5 chapters, complete), `trophology` (5
chapters, complete, en+ru — `context/course-plan-trophology.md`), and two
reader-facing 11-chapter courses (`homeopathy`, `herbalism`; ch. 1–3 live,
ch. 4–11 pending). Every course has an outline — chapter
one-liners, named concepts, seeds, reuse maps — in
`context/course-plan-<slug>.md`; follow the plan when writing the next
chapter. (A 5-chapter course maps Gate = 1 / Path = 2–4 / Summit = 5;
everything else in the blueprint is unchanged.) Frontmatter gotcha learned the hard way: **quote any `title:`/`excerpt:`
containing a colon** — an unquoted `… вечером: ваш …` is a YAML nested-mapping
error that blanks the whole SPA (the `import.meta.glob` parse happens at
runtime for every page).

## Add a Journal entry → `content/locales/en/journal/<slug>.md`

The **Journal** (user-facing "Journal" / «Заметки») is the site's
**human-written, date-ordered blog** — the honest counterpart to the
computer-assisted Compass. **Truth-first is the whole point here:** real notes
from the road only, no invented trips, durations, or scenes (the standing rules
above apply in full). Frontmatter: `title`, `excerpt`, `date`, optional `tags`,
optional `image`. Flat folder (no epic subfolders), no code/route wiring — the
file appears on `/journal` (newest first, filed under its year in the filter
chips) and opens through the same table-of-contents detail layout as a Compass
chapter. Use `##`/`###` headings so the TOC renders (3+ needed). RU entries in
her voice (persona-context).

**The "in the works" queue:** planned-but-unwritten entries live in
`upcomingJournal:` in `site.yaml` (both locales; titles are localized prose,
no urls) and render as the right-hand rail on `/journal` — same idea as the
reviews `upcoming:` queue. Add an idea when it's real, delete it when the
entry ships.

**The "Contribute!" button** on `/journal` copies a generic, topic-agnostic
scaffold — the single source is `content/shared/journal-template.<locale>.md`
(edit that file to change what gets copied; en is the fallback). `/reviews`
has the same button copying the review scaffold — see "Add a product review"
above; the shared mechanics are the "Contribute!" row in `development.md`.
The seed entry `journal/driving-with-a-toddler.md` (en+ru) is a
**topic-flavoured template the owner fills in** — kept as an explicit,
prompt-driven skeleton (honest: it says so), not a fabricated trip.

## Visuals inside guides (tables, diagrams, charts) — the house pattern

Every course chapter should carry 1–3 visuals that cement its concepts. Two
building blocks, both authored directly in the markdown — no images, no new
deps:

- **GFM tables** for comparisons and reference grids (`gfm: true` is on;
  styled via `.prose table` in `styles.css`, horizontal-scroll on ≤720px).
  Tables stay **inline per locale** — they're just text, nothing to share.
- **SVG diagrams** for flows, maps, charts, staircases, compasses. The
  **geometry is authored once as a shared template** and reused by every
  locale; only the text differs.

### Diagram templates + fenced blocks (the DRY pattern)

1. **The template** — `content/shared/diagrams/<name>.svg`, the whole SVG drawn
   once, with `{{slot}}` tokens wherever locale text goes:

   ```html
   <svg viewBox="0 0 640 240" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="{{aria}}">
   …
   <text x="66" y="78" text-anchor="middle" font-size="13.5" fill="var(--ink)">{{step1}}</text>
   …
   </svg>
   ```

   No `<figure>`/`<figcaption>` in the template — the renderer adds those. Slot
   names are any `[\w-]+`. **New diagrams: name slots meaningfully**
   (`{{step1}}`, `{{summit}}`). The original 16 diagrams use positional
   `t1…tN` (in document order) plus `aria` — leave those as-is.

2. **The embed** — in *each* locale's guide markdown, next to the prose, a
   fenced block whose language is `diagram <name>` and whose YAML body fills the
   slots (every template slot **plus** the required `caption`):

   ````markdown
   ```diagram founder-course-map
   aria: "The five chapters, gate to summit"
   step1: "1 · The model"
   summit: "5 · The gate"
   caption: "One caption line — adds something, never repeats adjacent prose."
   ```
   ````

3. **The renderer** (`renderDiagram` + a `marked` `renderer.code` override in
   `src/lib/content.ts`) substitutes slots, HTML-escapes every value, suffixes
   all SVG ids per instance (so marker ids never collide), and wraps the result
   in `<figure class="diagram">` + `<figcaption>`. A missing template/slot or
   bad YAML renders a visible `⚠` figcaption (never throws — a throw blanks the
   whole SPA); check the browser console for `[diagram]` errors.

Rules learned the hard way:

- **Fenced block, not raw `<figure>` HTML.** (The old inline-`<figure>` pattern
  tripped on "a blank line ends the markdown HTML block"; fenced blocks don't.)
- **Colors are CSS variables only** (`var(--mint)`, `var(--sage)`,
  `var(--on-accent)`, `var(--ink)`, `var(--muted)`, `var(--line)`,
  `var(--sand-2)`, `var(--clay)`) so every palette themes the diagram. Accent
  boxes = `--sage` fill + `--on-accent` text; warning accents = `--clay`.
- **viewBox width 640**, text 11–15px at that scale; `font-family` inherits
  via `.prose figure.diagram svg`. Marker ids in the template can be simple
  (`arr-fmap`) — the renderer makes them unique per instance automatically.
- **The template carries `role="img"` + `aria-label="{{aria}}"`**; each locale
  supplies the real `aria` text in its fenced block.
- **Size text for the longest locale.** RU labels run long; the *one* template's
  boxes/line-splits must fit RU (an empty slot value `""` is fine when a locale
  needs fewer lines than the template provides). After editing a template or any
  slot text, run the **overflow audit** in a served `dist/` (browser console,
  per guide page):

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

### Editing across locales (much smaller job now)

- **Geometry / layout / color change:** edit the *one* template in
  `content/shared/diagrams/` — every locale updates at once. No mirroring.
- **Text change:** edit the slot value in each locale's fenced block (RU in her
  voice — persona-context). The template is untouched.
- **New diagram:** add the template SVG, then add a `diagram <name>` fenced
  block to each locale's guide.
- **Verify parity** — every locale should reference each diagram, and every
  referenced template must exist:

  ```bash
  cd content/locales
  for lc in en ru; do printf '%s: ' $lc; grep -rho '```diagram [a-z-]*' $lc/compass | sort | wc -l; done
  # every referenced name has a template file:
  comm -23 <(grep -rho '```diagram [a-z-]*' */compass | sed 's/.*diagram //' | sort -u) \
           <(ls ../shared/diagrams | sed 's/\.svg$//' | sort)
  ```

## Add a standalone page → `content/locales/en/pages/<slug>.md` (+ wiring)

Pages are the one content type needing code wiring:

1. Create `content/locales/en/pages/<slug>.md` with frontmatter `title: …`.
2. Add a route in `src/App.tsx`:
   `<Route path="/<slug>" element={<MarkdownPage slug="<slug>" />} />`
3. Link it: primary nav → `nav:` in `content/locales/en/site.yaml`; secondary/legal →
   `footerNav:` in `site.yaml` (rendered as internal `<Link>`s in the footer).
   Keep the primary nav short — legal/meta pages belong in the footer.

Existing pages: `about`, `contact`, `roadmap`, `disclosure`, `privacy`. Most are
plain `MarkdownPage` routes.

The `support` page is the exception — a donation page (nav item, last in the
primary `nav:`) rendered by a **dedicated component** `src/pages/Support.tsx`,
not `MarkdownPage`. Only its **intro paragraph** is authored in
`pages/support.md` (per locale). The payment methods are **config-driven**: edit
the `support:` block in `content/locales/en/site.yaml` (Stripe URL, `paypal`
handle, `crypto:` list of `{coin, network, address}`) — that block is
non-localized, so it lives in `en/` only and `ru/` inherits it. The visible
labels/buttons are `support.*` UI strings in `src/locales/en.ts` + `ru.ts`. To
change what a supporter sees, the value goes in exactly one place: an address →
`en/site.yaml`; a label → both `*.ts`; the pitch → `pages/support.md`. PayPal
handle + wallet addresses are `PASTE-YOUR-…` placeholders — grep `PASTE-YOUR`
before shipping; never invent addresses. **YAML gotcha: always quote crypto
addresses and the PayPal handle.** An unquoted Ethereum `0x…` address is parsed
as a hex integer and silently corrupted (renders as `6.3e+47`); any all-digit
value becomes a number too. Quotes force a string — same family of bug as the
"quote any `title:` with a colon" rule. See the "Support / donation page" row
in `references/development.md` for the full wiring.

## The roadmap (`content/locales/en/pages/roadmap.md`)

Public, building-in-public, phased with `- [ ]` checkboxes. Maintenance rules:

- Tick items when milestones actually land; never pre-tick.
- New scope goes into the matching phase; don't create Phase 5 lightly.
- Update the "*Last updated: <Month Year>*" footer line on every edit.
- **The roadmap exists in both locales** — mirror every tick/edit in
  `ru/pages/roadmap.md` (RU in her voice) and update both footers. Quick
  parity check: the `- [` checkbox counts must match:

  ```bash
  for lc in en ru; do printf '%s: ' $lc; grep -c -- '- \[' content/locales/$lc/pages/roadmap.md; done
  ```

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
