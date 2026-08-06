# Task 00 — Foundation: tokens, primitives, footer, cookie banner, routes

**Branch:** `design/00-foundation` off `ui-improvements` — **after** fast-forwarding it
to `origin/main`, see the warning at the top of [README.md](README.md)
**Blocks:** every other task. Merge this into `ui-improvements` before cutting 01–05.
**Reference:** `design_handoff_snapexpense_paid/README.md` §"Design tokens",
§"Global footer", §"Cookie consent banner". Prototype markup: `SnapExpense App.dc.html`
lines 299–336 (footer) and 337–354 (cookie banner).

## Why this exists

Five page branches will run in parallel. Without a shared token layer and route
skeleton they would each invent their own hex values and each edit `layout.tsx`,
guaranteeing conflicts. This branch lands the shared surface so the page branches touch
only their own file.

Ship **no page content** here. Route stubs render a bare placeholder.

## 1. Design tokens

Add to `src/app/globals.css` as Tailwind v4 `@theme` tokens (the project is Tailwind v4
with `@import "tailwindcss/..."` — extend the existing `@theme inline` block, do not add
a `tailwind.config.js`).

The current `globals.css` has a `prefers-color-scheme: dark` block and a
`font-family: Arial` body rule that both fight this design. **The design is
light-only and monochrome — remove the dark-mode block** and the Arial rule.

| Token | Value | Role |
|---|---|---|
| `--color-page` | `#e8e8e8` | page background outside the frame |
| `--color-surface` | `#ffffff` | primary surface |
| `--color-surface-recessed` | `#f7f7f7` | hero, pricing, sign-in panel |
| `--color-surface-sunken` | `#fafafa` | footer, dropzone, quota row, summary card |
| `--color-border` | `#e4e4e7` | default border |
| `--color-border-strong` | `#d4d4d8` | buttons, dividers |
| `--color-text` | `#18181b` | primary text, primary button bg |
| `--color-text-secondary` | `#3f3f46` | |
| `--color-text-muted` | `#52525b` | links, avatar initials |
| `--color-text-tertiary` | `#71717a` | meta |
| `--color-text-faint` | `#a1a1aa` | eyebrow, copyright, row meta |
| `--color-text-placeholder` | `#c4c4c8` | |
| `--color-warning` | `#a16207` | "Needs category" status only |

Radii: 4 / 7 / 8 / 10 / 12 / 999px. Spacing is a 4px base — Tailwind's default scale
already covers it.

**Typography.** System stack, replacing the Geist fonts currently loaded in
`layout.tsx`: `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial,
sans-serif`, antialiased. Remove the `next/font/google` Geist imports from
`src/app/layout.tsx` — they are unused once the stack changes, and dropping them
removes a network dependency. Keep `--font-mono` only if something still uses it (the
landing hero placeholder does; task 01 will decide).

Global: `box-sizing: border-box` everywhere (Tailwind preflight already does this —
verify it survives, the pricing cards depend on it). Links `#52525b`, hover `#18181b`.
Add a `text-wrap: pretty` utility for headlines and long body, and a
`font-variant-numeric: tabular-nums` utility for amount and step-number columns.

**Focus rings.** The design specifies none; we must add one. Define a single
`:focus-visible` treatment that reads at ≥3:1 against both `#ffffff` and `#fafafa`, and
apply it globally rather than per-component.

**Motion.** The design has no transitions. Where one is unavoidable (hover), keep it
≤150ms and confined to `color`, `border-color` and `opacity`. Nothing moves.

## 2. Shared primitives

`src/components/ui/`. Keep these small and unopinionated — they exist to stop five
branches redefining the same button.

- `Button` — variants `primary` (bg `#18181b`, white text, 8px radius) and `outline`
  (1px `#d4d4d8`, hover border `#18181b`); sizes `sm` (13px, 8px/14px padding, 7px
  radius) and `md` (15px, 13px padding, 8px radius). Must support `disabled`
  (the pricing "Current plan" CTA) and render as `<a>` when given an `href`.
  Enforce a 44px minimum touch target at mobile widths — several 13px/8px buttons in
  the design currently miss it.
- `Card` — white, 1px `#e4e4e7`, radius prop (10px default, 12px variant), padding prop.
- `Input` + `Label` — real `<input>`, bound label via `id`, `type`, `autocomplete`,
  8px radius, 11px/13px padding, 14px text.
- `Pill` — status pill: 12px, 1px `#e4e4e7`, 999px radius, 3px/9px padding.
- `Badge` — compliance chip: 11px, 1px `#e4e4e7`, 4px radius, 3px/7px padding.
- `Eyebrow` — 13px/600, `0.08em` tracking, uppercase, `#a1a1aa`.

## 3. Global footer — `src/components/Footer.tsx`

Appears on **every** screen. Top border `#e4e4e7`, `#fafafa` background, 24px padding,
18px gap, three stacked bands. Copy is verbatim:

**Band 1** — `repeat(auto-fit, minmax(180px, 1fr))` grid, 16px gap. Each item is a
12px/600 `#27272a` title plus 12px `#71717a` body, line-height 1.45.

- Receipt images — "Encrypted at rest. Deleted 30 days after you delete the expense."
- Never sold — "No ad networks, no data brokers, no training on your receipts."
- Your data, exportable — "Download or wipe everything from Settings, any time."
- Payments — "Processed by our payment provider. We never store card numbers."

**Band 2** — space-between, 12px. Links (6px/16px gap, no underline, `#71717a`, hover
`#18181b`): Privacy · Terms · Refunds · Cookies · DPA · Subprocessors · Contact. Point
these at `/legal/privacy`, `/legal/terms`, `/legal/refunds`, `/legal/dpa`,
`/legal/subprocessors`, `/legal/contact`. "Cookies" is not a page — it reopens the
consent panel (see below). The legal pages themselves are out of scope for this task;
note in the PR that the links will 404 until they are written.
Chips on the right: CCPA/CPRA · GDPR · SOC 2 in progress.

**Band 3** — 12px `#a1a1aa`: "© 2026 snapExpense Inc. · San Francisco, CA". Placeholder
city — flag it as needing the entity's real registered address.

Market is **USD / US** (decided). Imprint became Contact because §5 DDG is a German duty
with no US equivalent — the slot stays, because a reachable business identity is still
the point. CCPA/CPRA leads the chips because California's regime is what actually binds
a US entity; the GDPR chip is kept for EU customers but **comes down if the client does
not serve EU users** — an unearned compliance badge is worse than no badge.

Each of the four band-1 statements is a commitment. If any becomes untrue, the footer
changes with it.

## 4. Cookie banner — `src/components/CookieBanner.tsx`

Sticky to the bottom of the viewport, white, top border `#d4d4d8`, shadow
`0 -8px 24px rgba(0,0,0,0.06)`, 16px/24px padding, space-between with 14px gap.

Left, 13px `#52525b`, max 520px, verbatim: "We use cookies that keep you signed in, and
nothing else unless you say yes. Analytics helps us see which features get used." plus
an underlined "Cookie policy" link.

Right, three buttons, 8px gap, **equal visual weight**: "Essential only" (outline),
"Choose" (outline), "Accept all" (primary). Reject must be as easy to reach as accept —
do not demote "Essential only" to a text link and do not make "Accept all" larger. This
is a legal requirement, not a style preference.

Behaviour:
- Shows only when no decision is stored. Persist the *decision*, not the banner state,
  in `localStorage` for one year.
- No non-essential script fires until a choice is recorded.
- "Choose" opens a per-category panel. **Not yet designed** — build the trigger and a
  minimal panel scaffold, and flag in the PR that it needs design.
- Revisitable from the footer's "Cookies" link, so the open/close state has to be
  reachable from `Footer`. Lift it into a small client context or a shared store
  mounted in `layout.tsx`.
- Render it as a dialog: focus-trapped, or at minimum announced and keyboard reachable.

## 5. Layout and routes

`src/app/layout.tsx`: mount `<Footer />` and `<CookieBanner />` below `{children}`,
system font stack on `<html>`, keep the existing metadata.

**The routing changes shape.** Today `src/app/page.tsx` is a client component that
renders `LoginScreen` when signed out and the whole expense app when signed in. The
design splits that three ways:

| Route | Content | Auth |
|---|---|---|
| `/` | marketing landing | public; redirect to `/receipts` if signed in |
| `/login` | magic-link sign-in | public; redirect to `/receipts` if signed in |
| `/receipts` | the expense app | authenticated; redirect to `/login` if not |
| `/pricing` | plans | public |
| `/checkout` | subscription setup | authenticated |

In this task:
- Create stub `page.tsx` files for `/login`, `/receipts`, `/pricing`, `/checkout` that
  render only a heading. Tasks 01–05 fill them in. Creating them here is what keeps the
  parallel branches from colliding.
- **Move the existing app wholesale into `/receipts`** — take the current `App`,
  `ExpenseRow` and `MobileExpenseCard` components across unchanged and unrestyled.
  Task 03 restyles them. Moving and restyling in the same branch makes the diff
  unreviewable.
- Leave `src/app/page.tsx` as a stub for task 01.
- Extract the session gate (the `useEffect` on `supabase.auth.getSession()` +
  `onAuthStateChange` at the bottom of the current `page.tsx`) into one reusable hook or
  provider — five routes need it, it should not be copy-pasted five times.

  The repo now has `src/lib/supabase-server.ts` (`createSupabaseServerClient()`, cookie
  backed via `@supabase/ssr`). That means the session is readable on the server, so
  these redirects can happen server-side in a layout or in middleware rather than as a
  client-side flash after hydration. **Prefer the server-side gate** — the client-side
  version renders the wrong page for a beat before redirecting, which is especially bad
  on `/` where the wrong page is a full marketing site. Keep the client `supabase`
  export for interactive calls (`signInWithOtp`, inserts, `onAuthStateChange`).
- `src/app/auth/callback/page.tsx` does `router.replace('/')` in **three** places on
  current `main` (success, error and fallback paths). The success path must become
  `/receipts` or a signed-in user lands on the marketing page after clicking their magic
  link; decide deliberately where the two error paths should land (`/login` with a
  message is the obvious choice) rather than leaving them on `/`.

## Definition of done

- `npm run build` and `npm run lint` clean.
- Every route renders with the footer and, on a fresh profile, the cookie banner.
- The existing signed-in expense flow still works end to end at `/receipts` — upload,
  extract, save, edit, delete, export CSV. **This is the regression risk in this
  branch;** test it against a real session before opening the PR.
- Magic link redirects to `/receipts`.
- No page-level styling work has been done. If you find yourself building the hero,
  stop — that is task 01.
