# User login & the campfire — action plan

Owner spec (2026-07-07): a header login button (left of the palette picker,
visible on mobile too, sized like the language switcher); clicking opens a
centered email/password dialog over a blurred backdrop; self-registration
creates `viewer`-role users; after login the button leads to the account page —
a campfire with every registered user seated around it in a circle (display
name + avatar placeholder). Magic-link and biometrics are future work (need
SMTP / WebAuthn); passwords for now.

## Security consequence (non-negotiable)

Open registration means "any valid session" is no longer enough for the
content endpoints — a stranger could sign up and write to the repo through
the GitHub PAT. Content operations therefore require the `editor` scope
(admin|editor role), enforced spec-first: `security: session: [editor]` in
openapi.yaml, checked by the same session middleware via the generated
SessionScopes value. `/auth/me` reports `editing: true` only for
admin/editor (and only when a storage backend is configured), so viewers
never see edit chrome.

## Steps

1. **Contract** (`backend/openapi.yaml` → `task be:gen`):
   - `Role` enum gains `viewer`.
   - `POST /auth/register` {email, password, displayName} → 200 (session,
     auto-login), 400 invalid, 409 email taken, 429 rate-limited.
   - `GET /users` (session) → members [{displayName, role, joinedAt, you}].
   - `displayName` added to login/register/me 200 responses.
   - Content ops: `security: session: [editor]` + 403 Forbidden response.
2. **Store** — migration `003_viewer_display_name.sql` rebuilds `users`
   (CHECK gains 'viewer'; `display_name` column; sessions cascade-wiped —
   users just log in again); `User.DisplayName`, `CreateUser` takes it,
   `ListUsers()`, `CanEdit()`.
3. **Auth** — `Register()` (validate email/password/name, `ErrEmailTaken`,
   `ErrInvalid`, viewer role, issues a session); Bootstrap stores the email
   local-part as the admin's display name.
4. **HTTP** — register + users handlers; register rate limit (10/hour/IP);
   middleware checks the `editor` scope → 403; `editing` = configured ∧
   CanEdit. Tests: register flow, viewer 403s, users list, rate limit,
   updated auth matrix.
5. **FE session seam** — `src/lib/session.tsx`: token (localStorage
   `gc-session`), `/auth/me` validation, `backendUp` probe (healthz when
   signed out), login/register/signOut, and the LoginDialog open state.
   `editMode.tsx` shrinks to a consumer: `active = me.editing`; `#edit` when
   signed out opens the dialog (prompts gone). contentEditor untouched.
6. **FE UI** — `UserButton` (header, left of ThemeSwitcher; person icon →
   initial-in-circle link to /account), `LoginDialog` (modal, blur backdrop,
   sign-in/register toggle), `pages/Account.tsx` (campfire SVG center, users
   in a trig circle, sign-out), `/account` route, en+ru strings, styles.
7. **Verify** — `task be:verify`, `task typecheck && task build`, browser
   e2e (register → campfire shows both users → viewer sees no edit chrome).
8. **Docs** — CLAUDE.md (backend + FE seams), development.md, roadmap (both
   locales: the backend bullet's "nothing reader-facing yet" is no longer
   true), then archive this dir.
