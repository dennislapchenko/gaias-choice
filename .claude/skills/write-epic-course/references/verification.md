# Verification battery — exact commands

Run these as written (substitute `<epic>` / `N`) instead of improvising your
own — each was tuned on a real run and its pass criterion is stated. Where a
check's canonical home is another doc, this file points there rather than
restating it.

Run everything from the repo root unless a step says otherwise.

## 1. Diagram parity + template existence

Canonical commands: `manage-site/references/content-editing.md` → "Verify
parity". Expected asymmetry: `inside-websites` diagrams are EN-only, so the
en/ru counts legitimately differ by that course's diagram count.

## 2. Structure greps

```bash
cd content/locales

# chapter sequence — expect exactly 1..N once each, per locale:
for lc in en ru; do printf '%s: ' $lc; \
  grep -rh '^chapter:' $lc/compass/<epic> | sort -V | tr '\n' ' '; echo; done

# heading skeleton — every chapter has exactly 8 "## " headings
# (prints only violators; silence = pass):
for f in {en,ru}/compass/<epic>/*.md; do n=$(grep -c '^## ' "$f"); \
  [ "$n" -ne 8 ] && echo "$f: $n"; done; true

# frontmatter image paths resolve (silence = pass):
grep -rh '^image:' {en,ru}/compass/<epic> | awk '{print $2}' | sort -u | \
  while read -r p; do [ -f "../../public$p" ] || echo "MISSING $p"; done
```

## 3. Link graph

```bash
cd content/locales

# every /compass/<epic>/<file> reference, with counts:
grep -rho '(/compass/[a-z0-9/-]*)' {en,ru}/compass/<epic> | tr -d '()' | \
  sed 's|/compass/||' | sort | uniq -c | sort -rn

# the set of real slugs to check against (epic-prefixed, matching the URLs):
ls en/compass/<epic> | sed "s|^|<epic>/|; s/\.md$//"
```

Pass: every referenced slug is a real file; mid-course chapters referenced
~3× per locale (prev-link, Trail next, next-hook), the last chapter ~2×
(no forward link into it from beyond, none out of it).

## 4. Truth-first sweep

```bash
cd content/locales
grep -rniE 'we spent|months on the road|after (weeks|months)|мы провели|мы месяц|cured|cures my|heals|вылечит|вылечил|исцелит' \
  {en,ru}/compass/<epic> || echo clean
```

Hits are not automatically failures — **read each one**. Benign examples from
past runs: a warning *against* promised cures; a Cyrillic substring match
inside an unrelated word. Anything that asserts lived experience the owners
don't have, or a medical promise, is a real failure — fix the prose.

## 5. Build gate

```bash
task typecheck && task build
```

(`vite build` alone does not type-check; both must be green.)

## 6. In-browser audit (served dist/)

Serve `dist/` with the preview server (`dist` config in `.claude/launch.json`,
`preview_start`). A plain static server has **no SPA fallback** — deep links
404. Load `/` once, then navigate client-side via `preview_eval`:

```js
history.pushState({}, '', '/compass/<slug>');
dispatchEvent(new PopStateEvent('popstate'));
```

To switch locale:

```js
localStorage.setItem('gc-lang', 'ru'); location.href = '/';
```

Per new chapter page × per locale, check:

- **No diagram errors:**
  `[...document.querySelectorAll('figcaption')].filter(f => f.textContent.includes('⚠')).length`
  must be `0` (a `⚠` figcaption is the renderer's slot/template error).
- **No SVG text overflow:** run the overflow audit snippet from
  content-editing.md "Visuals inside guides" (via `preview_eval`); empty
  output = pass.
- **TOC renders:** `preview_snapshot` and confirm the table of contents lists
  the chapter's h2 headings.

Then navigate to `/compass`, open the epic's tab, and confirm the chapter
list shows 1→N in order (snapshot, don't screenshot — text is what matters).

## 7. Spot-read (no tooling)

Read at least one full RU chapter — pick the most sensitive one (safety-heavy
or biography-adjacent) — against the persona 5-question test in
`context/persona-context.md`. Greps cannot judge voice; this step exists
because a chapter can pass 1–6 and still read like a translated manual.
