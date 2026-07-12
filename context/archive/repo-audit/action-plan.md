# Repo audit — action plan (owner picked: 1, 2, 5, 6, 7, 8; skipped: 3, 4)

**STATUS: executed 2026-07-09, all steps verified.** Measured result: main
chunk 1,958 → 1,841 kB (579 → 535 kB gzip) with the almanac (70 kB), editor
impl (35 kB), Account (9 kB), LoginDialog (4 kB) as on-demand chunks — and
boot no longer parses the 119-file markdown corpus (biggest UX win, not
visible in bundle numbers). Verified: typecheck+build green; reader pages
(home, journal detail, compass detail with diagram, desktop + narrow) on the
prod dist build; login → account → editor dialog end-to-end on the dev stack
(screenshot in session; no saves made). One bonus content fix: en tagline
missing space ("parentingon").

Owner's calls (2026-07-09): CI gates (3, 4) skipped — the assistant verifies
before every push, keep CI fast. Self-hosted runner on the prod VM: assessed,
recommended against (public repo ⇒ untrusted code on the prod box; hosted
runners are faster than the small VM anyway) — see findings doc. Editor split
(8) approved with mandatory UI verification after.

Steps in execution order; each has files + a success criterion.

1. **Lazy-chunk the almanac** — `src/components/Sidebar.tsx`:
   `lazy(() => import('./AstroCalendar'))` + `<Suspense fallback={null}>` in
   `AlmanacBody`. ✓ = build emits a separate astro chunk; main chunk shrinks
   ~150 KB; almanac still renders on desktop + mobile tab.
2. **Markdown parsed on first read** — `src/lib/content.ts` `loadCollection`:
   store body, define `html` as an enumerable lazy memoized getter. ✓ =
   typecheck green; detail pages + TOC render identically; listings never
   trigger a parse (spot-check via DEBUG timing or code read).
3. **(5) Pages `paths-ignore`** — `.github/workflows/deploy-pages.yml`: ignore
   `context/**`, `.claude/**`, `backend/**`, `deploy/**`, `CLAUDE.md`,
   `README.md`, `Taskfile.yml`, `.doco-cd.yml`. Never `content/**` or
   `frontend/**`. ✓ = this repo's docs commit skips the Pages run; the code
   commits still trigger it.
4. **(6) nginx headers** — `frontend/nginx/default.conf.template`: single
   `Cache-Control` via `add_header` (drop `expires`), repeat the three
   hardening headers inside `location /assets/`. ✓ = `task image` builds;
   curl shows all four headers on an asset.
5. **(7) Drop dead preconnect** — `frontend/index.html`. ✓ = grep gone.
6. **(8) Editor-surface split** — keep `src/lib/contentEditor.tsx` as a THIN
   shell (context + `useContentEditor` + inert default api) so its five
   importers (EntryDetail, ReviewDetail, DeleteButton, StateToggle, Upcoming)
   keep their import path; move the implementation (yaml CST machinery, editor
   overlays, ImageFrame/ImagePicker/FrontmatterFields tree) to a lazy
   `contentEditorImpl.tsx` mounted only when edit mode is active. Also lazy:
   `LoginDialog` (in session.tsx, renders only when `loginOpen`) and the
   `/account` route (App.tsx). ✓ = main chunk drops further; typecheck+build
   green; **UI verified in the browser**: reader pages identical (desktop +
   mobile width), login dialog opens, editor chrome + an edit dialog work
   against the dev backend.
7. **Docs + ship** — update CLAUDE.md (content loader sentence: parse is
   on-demand now), `references/development.md` (Where-things-live rows for the
   split files + lazy almanac), fold outcome into the findings doc, archive
   this dir per SKILL when done. Commits: `perf:` (1+2), `chore:` (5),
   `fix:` (6+7), `perf:` (8), `docs:` last. Verify gate before every push:
   `task typecheck && task build`; measured chunk sizes reported.

Risks & mitigations:
- Lazy getter + object spread: a `{...entry}` anywhere would trigger a parse
  (correct, just eager) — acceptable; grep shows no entry spreads in listings.
- Editor api race (impl chunk loading while chrome already visible): buttons
  no-op for the load beat; no crash. Acceptable for a 2-person editor surface.
- Almanac Suspense: panel body empty for one beat on slow links — cosmetic.
