# Agent brief — Task 00: Foundation

You are implementing **step 00 of a six-step sequence** that recreates a design handoff
in this codebase:

```
00 foundation  ← you are here
01 landing     /            02 sign-in   /login
03 inbox       /receipts    04 pricing   /pricing
05 checkout    /checkout
```

The steps run **strictly in order**. Nothing else can start until your work is reviewed
and merged, because you are building the shared surface — tokens, primitives, the global
footer, and the route skeleton — that all five page tasks depend on. Five agents will
then work in parallel off your foundation.

**A senior engineer reviews your PR before step 01 begins.** Optimise for a diff that is
easy to read and easy to disagree with, not for finishing quickly. A small, correct,
well-explained PR that leaves something undone is far better than a large one that
guesses.

---

## Before you write any code

1. **Read `AGENTS.md` in the repo root.** This is Next.js 16.2.12 and it has breaking
   changes versus what you may remember. Read the relevant guide in
   `node_modules/next/dist/docs/` before writing components or routes. Heed deprecation
   notices. Do not assume App Router conventions you remember are still current.
2. **Read `docs/design-tasks/00-foundation.md`** — the full task spec. This prompt is the
   brief; that file is the detail. Read `docs/design-tasks/README.md` too for the rules
   that apply across all six tasks.
3. **Read the design bundle** in `design_handoff_snapexpense_paid/` — `README.md` is the
   spec, `SnapExpense App.dc.html` is the prototype (reference only, never copy it into
   `src/`; it uses a prototype template syntax with `{{ }}`, `style-hover` and `<sc-if>`).

### Market: USD / US

This has been decided — **do not revisit it.** The product targets the US market in USD.
The app already formats amounts as `$`, so no currency migration is needed. Where the
original EU handoff said Imprint, VAT, GDPR-first or Berlin, the US decisions are baked
into the copy below. Use the copy in this prompt verbatim; it is authoritative over any
EU-flavoured wording you find in the bundle.

### Branching — read carefully

**`main` is not to be touched.** Do not branch from it, do not push to it, do not open a
PR against it. `ui-improvements` is the integration branch: you branch from it and you
merge back into it. Every one of the six tasks does the same.

Work in a git worktree. Branch **`design/00-foundation`** off `ui-improvements`.

**Precondition — verify before you branch.** `ui-improvements` must already contain the
PR #7 footer that Part A tells you to fix:

```bash
git cat-file -e ui-improvements:src/components/Footer.tsx && echo OK || echo MISSING
```

If that prints `MISSING`, `ui-improvements` has not been brought up to date and **you
must stop and say so** rather than working around it. Building on a stale base silently
reverts the security hardening (`/api/extract` auth, rate limiting, body-size cap) and
the `@supabase/ssr` cookie client. Do not fast-forward it yourself — that is the
reviewer's call.
- **`.env.local` is gitignored and will not exist in a fresh worktree.** Copy it from
  the main checkout. Without it the Supabase client fails and the build breaks. Never
  commit it, never hardcode the keys, never paste them into a file to "test".
- Run the dev server on a **non-default port** (`npx next dev -p 3010`). Other agents
  may be running on 3000 and you will otherwise test against their app and report their
  page as your own.
- **Never use bare `git stash` or `git stash pop`.** The stash stack is shared across all
  worktrees in this repo and you can destroy another agent's work. Use a WIP commit.

---

## What you own

Only these. Every other file belongs to a later task.

| Path | What |
|---|---|
| `src/app/globals.css` | design tokens |
| `src/app/layout.tsx` | font stack, footer + banner mount |
| `src/components/ui/*` | shared primitives |
| `src/components/Footer.tsx` | global footer (rewrite — see Part A) |
| `src/components/CookieBanner.tsx` | consent banner |
| `src/app/{login,receipts,pricing,checkout}/page.tsx` | **stubs only** |
| `src/app/receipts/*` | the existing app, moved verbatim |
| `src/app/auth/callback/page.tsx` | redirect targets |

### Explicitly out of scope — do not build these

The landing page, the sign-in form styling, the receipt inbox design, the pricing cards,
the checkout form. If you find yourself writing a hero section or a plan card, **stop** —
that is task 01 or 04 and you are creating a merge conflict for another agent.

Route stubs render a bare `<h1>` with the route name and nothing else. That is the point:
they reserve the file so five parallel branches don't all create it.

---

## Part A — Fix the existing footer

`src/components/Footer.tsx` already exists (PR #7). It is a minimal three-link footer,
and it implements **the design option that was explicitly rejected** — the handoff shows
minimal / trust-forward / progressive-disclosure explorations and states that option 1b,
trust-forward, was chosen. You are replacing it with the trust-forward footer specified
in Part D.

A review of that PR found five defects. Your replacement must not reproduce any of them,
and two are in `layout.tsx`, which you also own:

1. **Footer sits below the fold on every page.** All three `<main>` blocks in
   `src/app/page.tsx` use `min-h-screen`, and `layout.tsx` now wraps children in
   `<div className="flex-1">`. `min-height:100vh` guarantees the content fills the
   viewport, so the footer always starts below it — you must scroll a full screen to
   reach it even on the short login page. Fix the children (`min-h-full`, or drop the
   constraint since `body.min-h-full.flex.flex-col` already handles the layout). Keep
   the `flex-1` sticky-footer pattern; it is correct.
2. **All three links 404.** `/terms`, `/privacy`, `/support` have no routes. Your footer
   has seven links — see Part D for how to handle targets that don't exist yet.
3. **Contrast fails WCAG AA.** `text-zinc-400` (`#a1a1aa`) on `bg-zinc-50` (`#fafafa`) is
   **2.46:1**; 12px text needs 4.5:1. The spec uses `#71717a` for footer links (4.63:1,
   passes) and reserves `#a1a1aa` for the copyright line only. Follow the spec.
4. **Dark mode is half-disabled.** `bg-zinc-50` on `<body>` overrides the unlayered
   `body { background: var(--background) }` in `globals.css`, but `color:
   var(--foreground)` is untouched — so under `prefers-color-scheme: dark` the body is
   pinned light while inherited text resolves to `#ededed`. **This design is light-only.
   Delete the `@media (prefers-color-scheme: dark)` block from `globals.css`** rather
   than leaving the two fighting.
5. **Build-frozen year.** `new Date().getFullYear()` in a server component on a
   statically prerendered route bakes the year at build time. The spec gives a literal
   copyright line — use it.

---

## Part B — Design tokens

Add to `src/app/globals.css` as Tailwind v4 `@theme` tokens. This project is Tailwind v4
using `@import "tailwindcss/..."` — extend the existing `@theme inline` block. **Do not
add a `tailwind.config.js`.**

Also remove, from the current `globals.css`: the `@media (prefers-color-scheme: dark)`
block (finding 4) and the `font-family: Arial, Helvetica, sans-serif` body rule (it
fights the design's system stack).

| Token | Value | Role |
|---|---|---|
| `--color-page` | `#e8e8e8` | page background outside the frame |
| `--color-surface` | `#ffffff` | primary surface |
| `--color-surface-recessed` | `#f7f7f7` | hero, pricing, sign-in panel |
| `--color-surface-sunken` | `#fafafa` | footer, dropzone, quota row, summary card |
| `--color-border` | `#e4e4e7` | default border |
| `--color-border-strong` | `#d4d4d8` | buttons, dividers |
| `--color-text` | `#18181b` | primary text; primary button background |
| `--color-text-secondary` | `#3f3f46` | |
| `--color-text-muted` | `#52525b` | links, avatar initials |
| `--color-text-tertiary` | `#71717a` | meta, footer links |
| `--color-text-faint` | `#a1a1aa` | eyebrow, copyright |
| `--color-text-placeholder` | `#c4c4c8` | |
| `--color-warning` | `#a16207` | "Needs category" status only |

Radii: 4 / 7 / 8 / 10 / 12 / 999px. Spacing is a 4px base — Tailwind's default scale
covers it.

**Typography.** System stack, replacing the Geist fonts currently loaded in
`layout.tsx`: `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial,
sans-serif`, antialiased. Remove the `next/font/google` Geist imports once nothing uses
them — that also drops a network dependency. Add utilities for `text-wrap: pretty`
(headlines, long body) and `font-variant-numeric: tabular-nums` (amounts, step numbers).

**Focus rings.** The design specifies none; we must add one. Define a single
`:focus-visible` treatment that reads at **≥3:1 against both `#ffffff` and `#fafafa`**,
applied globally rather than per-component. State the ratio you achieved in the PR.

**Motion.** The design has no transitions. Where hover demands one, keep it ≤150ms and
confined to `color`, `border-color` and `opacity`. Nothing moves or animates.

`box-sizing: border-box` must apply globally — Tailwind preflight does this, but
**verify it survives**, because task 04's pricing cards break without it.

---

## Part C — Shared primitives

`src/components/ui/`. Keep these small. They exist so five parallel agents don't each
invent a Button.

- **`Button`** — variants `primary` (bg `#18181b`, white text) and `outline` (1px
  `#d4d4d8`, hover border `#18181b`); sizes `sm` (13px, 8px/14px padding, 7px radius) and
  `md` (15px, 13px padding, 8px radius). Must support `disabled` (task 04 needs a
  disabled "Current plan" CTA) and render as a link when given `href`. **Enforce a 44px
  minimum touch target at mobile widths** — several 13px/8px-padded buttons in the design
  miss it.
- **`Card`** — white, 1px `#e4e4e7`, radius prop (10px default, 12px variant), padding prop.
- **`Input`** + **`Label`** — real `<input>`, label bound by `id`, `type`,
  `autocomplete`, 8px radius, 11px/13px padding, 14px text.
- **`Pill`** — status pill: 12px, 1px `#e4e4e7`, 999px radius, 3px/9px padding.
- **`Badge`** — compliance chip: 11px, 1px `#e4e4e7`, 4px radius, 3px/7px padding.
- **`Eyebrow`** — 13px/600, `0.08em` tracking, uppercase, `#a1a1aa`.

---

## Part D — Global footer

Appears on every screen. Top border `#e4e4e7`, `#fafafa` background, 24px padding, 18px
gap, three stacked bands. **This copy is legally reviewed — reproduce it exactly.**

**Band 1** — `repeat(auto-fit, minmax(180px, 1fr))` grid, 16px gap. Each item: 12px/600
`#27272a` title, 12px `#71717a` body, line-height 1.45.

- **Receipt images** — "Encrypted at rest. Deleted 30 days after you delete the expense."
- **Never sold** — "No ad networks, no data brokers, no training on your receipts."
- **Your data, exportable** — "Download or wipe everything from Settings, any time."
- **Payments** — "Processed by our payment provider. We never store card numbers."

**Band 2** — space-between, 12px. Links (6px/16px gap, no underline, `#71717a`, hover
`#18181b`): **Privacy · Terms · Refunds · Cookies · DPA · Subprocessors · Contact.**
Chips on the right: **CCPA/CPRA · GDPR · SOC 2 in progress.**

"Cookies" is not a page — it reopens the consent panel. The other six point at
`/legal/{privacy,terms,refunds,dpa,subprocessors,contact}`.

**None of those routes exist.** Do not create them — legal pages are separate work with
real copy. Wire the hrefs as specified and **call out in your PR that six footer links
will 404 until those pages are written**, so the reviewer decides whether that blocks
release. Do not "solve" this by removing links or pointing them at `#`.

**Band 3** — 12px `#a1a1aa`, literal: `© 2026 snapExpense Inc. · San Francisco, CA`

The city is a placeholder — flag it in the PR as needing the entity's actual registered
address.

Each of the four band-1 statements is a **commitment**, not marketing. If any becomes
untrue the footer changes with it. Note in your PR that "SOC 2 in progress" must come
down or become "SOC 2 Type II" once the audit resolves, and that the GDPR chip should be
removed if the client does not serve EU users — an unearned compliance badge is worse
than no badge.

---

## Part E — Cookie banner

`src/components/CookieBanner.tsx`. Sticky to the bottom of the viewport, white, top
border `#d4d4d8`, shadow `0 -8px 24px rgba(0,0,0,0.06)`, 16px/24px padding,
space-between with 14px gap.

Left, 13px `#52525b`, max 520px, verbatim:

> We use cookies that keep you signed in, and nothing else unless you say yes. Analytics
> helps us see which features get used.

plus an underlined "Cookie policy" link.

Right, three buttons, 8px gap, **equal visual weight**: "Essential only" (outline),
"Choose" (outline), "Accept all" (primary).

> **Reject must be as easy to reach as accept.** All three sit at the same level with
> equal weight. Do not demote "Essential only" to a text link. Do not style "Accept all"
> larger or give it more prominence. This is a legal requirement, not a style preference,
> and it is the single thing most likely to get changed by accident.

Behaviour:
- Show **only when no decision is stored.** Persist the *decision*, not the banner state,
  in `localStorage` for one year.
- No non-essential script fires until a choice is recorded.
- "Choose" opens a per-category panel. **Not yet designed** — build the trigger and a
  minimal scaffold, and flag in the PR that it needs a design pass.
- Reachable again from the footer's "Cookies" link, so the open state must be shared
  between `Footer` and `CookieBanner`. Lift it into a small client context mounted in
  `layout.tsx`.
- Render as a dialog: focus-trapped, or at minimum announced and keyboard reachable.

This banner is opt-in, which is stricter than US law requires (state privacy laws are
opt-*out*). That is deliberate for a product whose pitch is privacy — **do not quietly
relax it to opt-out during implementation.**

---

## Part F — Layout and routing

The routing changes shape. Today `src/app/page.tsx` is one client component that renders
a login screen when signed out and the entire expense app when signed in.

| Route | Content | Auth |
|---|---|---|
| `/` | marketing landing (task 01) | public; redirect to `/receipts` if signed in |
| `/login` | sign-in (task 02) | public; redirect to `/receipts` if signed in |
| `/receipts` | the expense app (task 03) | authenticated; redirect to `/login` if not |
| `/pricing` | plans (task 04) | public |
| `/checkout` | subscription setup (task 05) | authenticated |

In this task:

- Create stub `page.tsx` for `/login`, `/receipts`, `/pricing`, `/checkout`.
- **Move the existing app wholesale to `/receipts`** — take `App`, `ExpenseRow` and
  `MobileExpenseCard` across **unchanged and unrestyled**. Task 03 restyles them. Moving
  and restyling in one branch produces an unreviewable diff.
- Leave `src/app/page.tsx` as a stub for task 01.
- Extract the session gate (the `useEffect` on `supabase.auth.getSession()` +
  `onAuthStateChange`) into one reusable hook or provider — five routes need it.

  The repo has `src/lib/supabase-server.ts` (`createSupabaseServerClient()`, cookie-backed
  via `@supabase/ssr`), so the session is readable on the server. **Prefer a server-side
  gate** in a layout or middleware: the client-side version renders the wrong page for a
  beat before redirecting, which is especially bad on `/` where the wrong page is a full
  marketing site. Keep the client `supabase` export for interactive calls
  (`signInWithOtp`, inserts, `onAuthStateChange`).
- `src/app/auth/callback/page.tsx` has **three** `router.replace('/')` calls (success,
  error, fallback). The success path must go to `/receipts`, or a signed-in user lands on
  the marketing page after clicking their magic link. Decide deliberately where the two
  error paths go — `/login` with a message is the obvious choice — rather than leaving
  them on `/`.

---

## Constraints

- **Never touch `main`** — no commits, no pushes, no PRs against it. Everything targets
  `ui-improvements`.
- **Never force-push**, and never merge anything yourself. Your branch is reviewed before
  it lands.
- **No new dependencies.** If you believe one is genuinely required, stop and say so in
  the PR instead of adding it. Lockfile conflicts across six branches are miserable.
- **No icon library.** The design is text-only by deliberate choice.
- **No hardcoded hex values in components** — use the tokens from Part B. If a token is
  missing, add it and say so.
- **Do not touch** `src/app/api/extract/route.ts`, `src/lib/supabase.ts`, or the database
  schema. The API route has auth, rate limiting and a body-size cap that were added
  deliberately.
- The shared Supabase project is used by every agent, and `/api/extract` rate-limits to
  **20 extractions/hour per user, enforced server-side**. If you exhaust it while
  testing, later agents get spurious failures. You should barely need it.

---

## Verify before opening the PR

- [ ] `npm run build` clean
- [ ] `npm run lint` clean
- [ ] Every route renders, with the footer visible **without scrolling** on a short page
      (this is finding 1 — check `/login` specifically)
- [ ] Cookie banner appears on a fresh profile, does not reappear after a choice, and
      reopens from the footer's "Cookies" link
- [ ] Footer link contrast measured at ≥4.5:1; focus ring measured at ≥3:1 on both
      `#ffffff` and `#fafafa`. **State the numbers in the PR.**
- [ ] Keyboard-only pass: tab to every footer link and all three banner buttons; focus
      always visible
- [ ] **Full regression of the existing app at `/receipts` against a real session** —
      upload a receipt, confirm extraction, save, edit inline, delete, export CSV, on
      both the desktop table and the mobile card path. **This is the main risk in this
      branch.** You moved working, data-backed code; prove you did not break it.
- [ ] Magic link lands on `/receipts`
- [ ] Checked at 1080 / 768 / 420px
- [ ] No page-level design work leaked in from tasks 01–05

## Your PR description must contain

Your reviewer is a senior engineer who will read the diff closely. Make their job easy:

1. **What you changed and why**, ordered by importance — not a file list.
2. **The five PR #7 findings**, each marked fixed or not, with how.
3. **Measured numbers**: footer link contrast, focus ring contrast.
4. **Every assumption you made** where the spec was silent or ambiguous.
5. **Every deviation from the spec**, with your reasoning. Deviations are acceptable;
   silent ones are not.
6. **Known-incomplete items you were told to flag**: the six 404ing legal routes, the
   undesigned cookie category panel, the placeholder city, the SOC 2 / GDPR chip
   conditions.
7. **What you did not test**, honestly.

Keep commits small and logically separated — tokens, primitives, footer, banner, routing
should not be one commit. Open the PR as a **draft** against `ui-improvements`.

If you hit something genuinely ambiguous that changes the shape of the work, **stop and
ask** rather than guessing. A blocked PR with a good question costs less than a merged
one built on a wrong assumption that five downstream tasks inherit.
