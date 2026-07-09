---
title: "Shipping the Box: Containers, nginx and the Supply Chain"
excerpt: The delivery layer — the multi-stage image, the one nginx line that keeps an SPA alive, push-as-deploy, and why npm never touches the host.
image: /images/guide-inside-04-shipping-the-box.svg
date: 2026-07-05
chapter: 4
tags: [inside-websites, devops]
---

> **Chapter 4 of 5 · The Path** — [← Chapter 3: The Living Page](/compass/inside-03-the-living-page) · [Chapter 5: Owning the Stack →](/compass/inside-05-owning-the-stack)
> *You can already:* read the whole browse-time machine — components, router, state — and explain every click.
> *This chapter adds:* how the machine ships and stays trustworthy — the container, the serving config, the deploy path, and the supply-chain discipline underneath all three.

> **Engine-room course.** Written to explain this very site's code to our own
> team — every file path named here is real; the site you're reading is the
> lab.

## The 404 that isn't

Chapter 3 left a wire exposed. Paste
`/compass/inside-03-the-living-page` into a fresh tab. The browser sends
that path to the server. The server has **the bundle** — `index.html`,
`assets/`, images. There is no file called
`compass/inside-03-the-living-page` in it. Every static host in the world
answers that request with a 404 — and if you build this site and serve
`dist/` with any dumb file server, that is exactly what you'll get on
every deep link.

The fix is one idea and about one line, and it lives in
`nginx/default.conf.template`:

```nginx
try_files $uri $uri/ /index.html;
```

Try the requested path as a file; if nothing matches, serve **the one HTML
page** anyway. The JavaScript boots, the router (chapter 3) reads the URL
it was actually loaded on, matches it against the route table, and paints
the right page. Server and client split one job: the server answers *every*
path with the same page, and the client makes the path mean something. This
is the defining operational quirk of hosting an SPA — miss it and the site
works perfectly until the first person shares a link.

Two honest footnotes, because config is claims too: `/assets/` is exempt —
a missing hashed bundle file is a real error and hard-404s. But a missing
*image* path falls through to `index.html` with a 200, so a broken image
reference here never shows up as a 404 in the logs. Known, accepted,
documented — the kind of tradeoff you should be able to state about your
own configs.

## The box: a multi-stage build

The `Dockerfile` is short and its shape *is* chapter 1's two-phase machine,
cast in infrastructure:

- **Stage 1 (`node:22-alpine`):** copy the recipe in, `npm ci` the pinned
  dependencies, run the build, produce `dist/`. This stage is build time —
  it exists for minutes and is discarded.
- **Stage 2 (`nginx:1.27-alpine`):** copy `dist/` out of stage 1, add the
  config template. This is the entire shipped artifact.

Everything that made the site — Node, npm, the compiler, several hundred
megabytes of `node_modules` — is left behind on the cutting-room floor.
The runtime image is nginx and a folder of files: small, dull, and with the
attack surface of a rock. If you run containers for a living you already
know this pattern; what's worth noticing is how *far* it goes here — the
production box contains no JavaScript runtime at all. There is nothing to
patch but nginx itself.

One portability detail: the container can't hardcode a port, because a host
may hand it one at boot. The base image runs `envsubst` on the template at
startup, substituting `${PORT}` and nothing else — nginx's own `$uri`
variables pass through untouched. Twelve-factor's "config from the
environment," in its smallest possible form — the reason this same box runs
unchanged whether a platform injects a port or you pick one yourself.

## The deploy: a push is a release

There is no deploy ceremony. `.github/workflows/deploy-pages.yml` watches
`main`; every push builds the site and publishes the bundle to GitHub
Pages. Pushing `main` *is* deploying to production — the repo's docs say it
in bold, because the fact changes how you treat the button. And the same
bundle drops straight into the nginx box from earlier this chapter —
`task run` serves it locally exactly as any container host would; the bundle
doesn't care who serves it, which is what being a folder of files buys.

```diagram delivery-pipeline
aria: "The delivery pipeline: a push to main triggers the workflow, a container runs the pinned install and build, the bundle comes out, nginx or GitHub Pages serves it, and the reader receives static files"
s1: "git push"
s1sub1: "to main ="
s1sub2: "a release"
s2: "CI builds"
s2sub1: "npm ci, pinned"
s2sub2: "vite build"
s3: "the bundle"
s3sub1: "dist/ — the"
s3sub2: "only artifact"
s4: "the host"
s4sub1: "nginx / Pages"
s4sub2: "try_files fallback"
s5: "reader"
s5sub1: "static"
s5sub2: "files"
footer: "No servers to babysit — the pipeline's product is a folder, and the host's job is to hand it out."
caption: "The whole path from keyboard to reader. Note what's absent: no migration step, no restart, no warm-up — nothing runs, so nothing needs orchestrating."
```

## The supply chain: where the real risk lives

Now the part of the machine you can't see in any diagram. This site's own
code is small and readable in a sitting. Its `node_modules`, like
everyone's, is thousands of files written by strangers — and in modern
frontend work, **that is where the real risk lives**. Recall chapter 2's
trust boundary: content was inside it, user input was outside. Ask the same
question of code and the honest answer is that every npm package you
install is *outside* your trust boundary, yet the ecosystem's default is to
execute it on your laptop at install time — lifecycle scripts run arbitrary
code the moment `npm install` finishes. Most supply-chain attacks of the
last decade needed nothing more.

This repo's response is a small set of rules, each mapped to the specific
failure it blocks:

| Rule | Mechanism | What it blocks |
| --- | --- | --- |
| Install scripts never run | `.npmrc` → `ignore-scripts=true` | postinstall malware — the classic attack |
| npm never runs on the host | every task runs in a throwaway `node:22-alpine` container; `node_modules` lives in a Docker volume | a compromised package reading your home dir, SSH keys, tokens |
| The tree is pinned | `package-lock.json` + `npm ci` | "it built differently on Tuesday" — and silently swapped versions |
| Vulnerabilities surface | `task audit` must stay at zero | shipping known-bad versions out of inattention |
| The tree stays small | **five** runtime deps — react, react-dom, react-router-dom, marked, yaml (plus astronomy-engine for the almanac) | the transitive sprawl that makes the other rules unenforceable |

The last rule is the load-bearing one, and it's cultural, not technical:
every new dependency is treated as a real decision. The default answer is
"write the few lines instead" — chapter 2's frontmatter parser exists
because of exactly this reflex. A five-package tree is one you can actually
read the lockfile of; a five-hundred-package tree makes auditing a
ceremony. This is also why chapter 1's practice pointedly didn't ask you to
install Node: the machine is built so the host never needs it.

## The Taskfile: one interface to all of it

Gluing the layers together is `Taskfile.yml` — the repo's only entry point.
`task dev`, `task build`, `task typecheck`, `task audit`, `task image`,
`task run`: every command already wrapped in the container
dance, so doing it the safe way and doing it the easy way are the same
action. One habit-forming detail: `vite build` does **not** type-check —
`task verify` (audit + typecheck + image build) exists so the strict
compiler actually gates a release. If you take one operational idea from
this repo for your own projects, take this one: make the safe path the
short path, or nobody walks it.

## Practice

Ship your copy through the real pipeline — the artifact from chapters 1–3
goes into the box (30–45 minutes, Docker running):

1. Run `task verify` — audit, typecheck, image build. Watch what each gate
   would have caught.
2. Run `task run` and open `http://localhost:8080`. This is not the dev
   server: it's the production nginx box, serving your bundle — with your
   chapter-2 review and chapter-3 palette inside it.
3. Test the seed from chapter 3:
   `curl -i http://localhost:8080/compass/inside-01-the-whole-machine` —
   status 200, HTML body: the fallback at work. Then
   `curl -i http://localhost:8080/assets/nope.js` — a real 404.
4. Look inside the box: `docker run --rm -it --entrypoint sh` on the image,
   `ls /usr/share/nginx/html`, and confirm there's no `node` binary in it.

**How to know it worked:** your changed site is served by nginx on :8080, a
deep link answers 200, a missing asset answers 404, and you can state which
Dockerfile stage each fact comes from. (If `task verify` is slow the first
time, that's the dependency volume warming — the second run is the honest
number.)

## Now you can

- Explain the SPA fallback from both sides: what the server does with an
  unknown path and what the client does with it after boot.
- Read the multi-stage Dockerfile and say what ships, what's discarded, and
  why the runtime image has almost no attack surface.
- Trace a `git push` to a live release and name the artifact at each step.
- Defend each supply-chain rule by naming the specific attack or failure it
  blocks — and argue for a small dependency tree as the rule that enables
  the rest.
- Use the Taskfile as the single safe interface to build, verify, run and
  ship.

## Check yourself

Answer from memory:

1. Why do deep links 404 on a naive static host but not here — and which
   *two* components, on which sides of the two-phase machine, cooperate in
   the fix?
2. What is in the final image, and what notable thing is not?
3. Which npm feature do most install-time attacks ride on, and which single
   line disables it here?
4. Why does this repo run npm only inside containers when the packages are
   the same either way — what asset is being protected?

## Next

You now hold all four layers: content, build, browser, box. What's left is
the part no single layer can teach — judgment. This architecture was
*chosen*, and it quietly pays a real price: the one HTML page that makes
chapters 3 and 4 so simple is nearly empty, and everything that reads pages
without running JavaScript — search crawlers, link previews, Pinterest —
sees almost nothing. Whether that trade is right, when it stops being
right, and how you'd rebuild all of this from zero — that's the summit.

**[Chapter 5: Owning the Stack →](/compass/inside-05-owning-the-stack)**
