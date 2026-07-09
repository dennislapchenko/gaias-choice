---
name: agent-efficiency-housekeeping
description: >-
  Audit and tune this repo's agent knowledge system — CLAUDE.md, skills,
  references/, context/, MEMORY.md, settings — for correctness and token
  cost. Use when asked to "do housekeeping", "audit the skills/docs",
  "improve agent efficiency", or when docs contradict reality or each other,
  a merged change left docs stale, or the same friction hit ≥2 runs.
---

# Agent-efficiency housekeeping

Periodic maintenance of the machinery that makes agent runs fast and correct.
The product is usually **one docs commit** (plus local hygiene outside the repo).
Two bars, both must hold:

1. **Correctness** — a fresh agent following only the written instructions
   produces correct output on the first pass. Anything where that fails is a P1.
2. **Token efficiency** — the *cost of the context an agent must read* to act
   correctly is as low as it can be without losing correctness. Every duplicated
   fact, every stale line, every doc that repeats what another owns, every
   over-long skill description is tokens loaded into every run's context window.
   Efficiency is not only fewer lines of code — it is **fewer tokens to load,
   parse, and reconcile before the first correct action.** The whole of CLAUDE.md
   plus every triggered skill is paid on every session; trim what doesn't earn
   its place.

## When to run (trigger checklist)

Run when the user asks, or **proactively suggest it** when any of these is true:

- **Contradiction discovered mid-run** — a doc told you something reality
  disproved. Don't batch this one; stale instructions actively mislead the next
  run. Fix immediately.
- **A code/workflow change merged** whose behavior the docs describe — docs lag
  the code (a flag renamed, a task removed, a path moved).
- **Skill/doc edits sitting on unmerged branches** — knowledge stranded where no
  fresh run sees it: `git log --oneline --all --not main -- .claude/ CLAUDE.md references/`.
- **Repeated friction** — the same manual step or correction appeared in ≥2
  recent runs (git history shows repeated small fixes to the same doc section).
- **Context bloat** — CLAUDE.md, a SKILL.md, or a reference has grown a section
  that duplicates another doc, keeps changelog/history framing, or restates the
  code. Loaded-every-run prose that isn't pulling weight is a token tax. Root
  cause to watch: `feat:` commits routing component/CSS/flow prose into the
  always-loaded CLAUDE.md instead of an on-demand `references/` row — the guard
  is CLAUDE.md's doc-layout rule (one sentence + pointer; mechanics to a
  development.md row). A run of small CLAUDE.md growth across recent feature
  commits is the tell.

## Evidence to gather (read before judging)

- The knowledge surfaces, in load-order of cost:
  - `CLAUDE.md` — architecture + invariants (paid every session).
  - `.claude/skills/*/SKILL.md` — each skill's front-matter `description` is what
    the model reads to decide whether to trigger; the body loads on invoke.
  - `references/*.md` — change-X-edit-Y mechanics, development gotchas.
  - `context/*.md` — authoring/voice/worldview source (not bundled into the site).
  - `MEMORY.md` + the auto-memory files — pointers loaded each session.
  - `.claude/settings.json` / `settings.local.json` — permission allowlist.
- The code those docs cite: `Taskfile.yml`, `src/lib/*`, `backend/`,
  `vite.config.ts`. Open each claim-bearing target and check the doc against it.
- **Git history as signal**: `git log --oneline -- CLAUDE.md .claude/skills/` —
  repeated small commits fixing the same prose = churn = that fact wants a
  single canonical home, not restating. Commits on branches not in `main` =
  stranded.
- Outside the repo: `~/.claude/skills/` (duplicate/drifted copies of repo
  skills), personal auto-memory holding **shared** process knowledge.

**Measuring the token win (before proposing cuts).** Size by owner, because the
repo only controls part of the fresh load — chasing a total-context target the
repo can't reach wastes the pass. Rough buckets of a ~50k fresh session: harness
system prompt + core tool schemas ~13–15k and built-in skill descriptions ~5–6k
(**not touchable**); desktop-app MCP schemas (Claude_Preview/visualize/ccd) +
their instructions ~7k (**app-UI toggle only**, ~10k floor in the desktop app);
**the repo owns only ~10.5k** — CLAUDE.md (~9.5k) + the repo skill descriptions
(~0.9k) — plus user-level toggles (ponytail hook+descriptions ~2k, chrome/
computer-use ~2.5k). So repo work alone lands the total ~44k; the 20–30k range is
only reachable in a plain CLI session (no app MCP layer). Set the target against
the bucket you can actually move. Estimate tokens as bytes ÷ ~3.8 for prose (path-
/JSON-dense text skews higher); verify with `wc -c` byte targets per file and
`/context` before/after in a fresh session. Full worked example:
`context/token-budget/action-plan.md`.

## Defect taxonomy (hunt in priority order)

1. **Docs vs reality** — a doc claims what the code no longer does (or never did).
   Worst class: a well-behaved agent produces wrong output. Verify every cited
   task, flag, path, and file still exists and behaves as described.
2. **Docs vs docs** — CLAUDE.md vs a SKILL vs a reference disagree on a step.
   This repo's rule is **one fact, one home** (CLAUDE.md top matter): architecture
   in CLAUDE.md, process in `manage-site`/`write-epic-course` SKILLs, mechanics in
   `references/`, voice in `context/`. Pick the owning home, align the rest, and
   replace the copies with a pointer.
3. **Token tax — prose that costs more context than it earns.** The efficiency
   half of the bar. Hunt for: the same fact stated in two loaded docs (collapse to
   one home + a pointer); changelog/"renamed from"/dated history that CLAUDE.md
   forbids (delete — git answers those); a SKILL body or CLAUDE section restating
   what the code plainly says (cut to a path reference); a skill `description`
   longer than it needs to trigger reliably (every description is read every
   session). Measure the win in tokens-loaded-per-run, not just lines.
4. **Trigger accuracy** — a skill's `description` fires too rarely (a real task
   doesn't match it) or too broadly (it hijacks unrelated turns). A miss costs a
   whole wrong or doc-less run; keep descriptions specific and example-anchored.
5. **Stranded knowledge** — ratified decisions on unmerged branches, in chat
   history, or in personal memory. Shared process facts belong in committed
   docs/skills; memory keeps pointers only (see MEMORY.md's own rule).
6. **Duplicates & drift** — the same skill/doc in two places (repo + `~/.claude`),
   near-duplicate caveats accreting instead of one edited note.
7. **Friction polish** — permission allowlist missing safe read-only helpers,
   typos, dead workaround notes, stale status/state tables.

## Method rules

- **Analysis first, then propose, then (on approval) implement.** Findings
  ordered: correctness (1–2) > efficiency & cycle health (3–5) > polish (6–7).
- **Verify, don't trust**: for each doc claim, open the task/file it describes;
  for each "done/fixed" note, check `main`.
- **The fresh-agent test** decides correctness priority: "an agent following this
  doc verbatim — does its output pass review?" **The context-cost test** decides
  efficiency priority: "does a run still pass that test if this prose is gone?
  Then it's tax — cut or collapse it."
- Ship as **one docs commit** (`docs: <slug>`). **Never commit automatically —
  ask the owner first** (CLAUDE.md / manage-site rule); a push to `main` is a
  production deploy. Local hygiene (deleting `~/.claude` duplicates, trimming
  memory) happens outside the commit — list it in the final report.
- **Zero render/behavior impact expected.** This skill only touches docs, skills,
  and settings. If a change would touch `src/`, `content/`, or `backend/`, it's
  out of scope here — split it out.

## Success criteria (loop until true)

- No known docs-vs-reality or docs-vs-docs contradiction remains.
- Every fact has one home; loaded-every-run prose that fails the context-cost
  test is cut or collapsed to a pointer.
- Every skill `description` triggers on its real tasks and not on foreign ones.
- Every repeated manual step is either scripted/tasked or consciously documented
  as manual (with the judgment reason).
- No shared process fact is stranded on a branch, in chat, or in memory alone.

## Maintaining this skill

This skill is itself in scope for its own audits. If a run reveals a new defect
*class* (not instance), add it to the taxonomy; if a trigger fired too late or
too often, tune the checklist. Keep precedents concrete — they're the calibration
examples for future runs.
