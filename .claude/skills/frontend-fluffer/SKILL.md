---
name: frontend-fluffer
description: >-
  Fix a UI element on Gaia's Choice from a marked screenshot — the owner
  pastes a screenshot with a circle/arrow/note ("make this bigger", "wrong
  color", "misaligned") and this runs the locate → inspect → fix → prove-back
  workflow. Invoke on any annotated-screenshot UI request.
---

# Frontend fluffer — marked screenshot → shipped UI fix

A thin entry point, not a second rulebook: this IS a manage-site task, so all
house rules apply (container-only npm, content-as-data, palette vars, the
`.claude/behavior.yaml` commit gate).

1. Run the four-step recipe — **"UI fix from a marked screenshot"** under
   "Common dev tasks" in
   `.claude/skills/manage-site/references/development.md`
   (locate via the change-X table → inspect computed styles, don't guess from
   pixels → fix with palette vars/breakpoints → prove back with screenshots
   in both default palettes + the 900px stack point).
2. If the marked thing turns out to be *content* (copy, a title, an image)
   rather than chrome, reclassify via manage-site "First, classify the task" —
   it's probably a `content/` edit, not CSS.
3. Done = the same element re-screenshotted, fixed, light + dark, shown to
   the owner.
