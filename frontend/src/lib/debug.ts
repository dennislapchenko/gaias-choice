/**
 * Sitewide debug gate. Wrap any dev-only chrome (viewport read-outs, state
 * dumps, timing overlays) in `DEBUG && …` so it never reaches visitors.
 *
 * On automatically during `vite dev` (incl. a tunnelled on-device test against
 * the dev server). Force it either way — a prod-like build, or a noisy dev
 * session — with `VITE_DEBUG=true|false`. Prod Pages builds leave it unset, so
 * it defaults OFF there regardless of what any content file says.
 */
export const DEBUG =
  import.meta.env.VITE_DEBUG != null
    ? import.meta.env.VITE_DEBUG === 'true'
    : import.meta.env.DEV
