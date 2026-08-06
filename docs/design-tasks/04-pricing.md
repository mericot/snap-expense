# Task 04 — Pricing (`/pricing`)

**Branch:** `design/04-pricing` off `ui-improvements` (after task 00 has merged)
**Owns:** `src/app/pricing/page.tsx`, `src/lib/plans.ts`
**Reference:** `design_handoff_snapexpense_paid/README.md` §"4. Pricing".
Prototype markup: `SnapExpense App.dc.html` lines 192–251.
**Depends on:** task 00 tokens, `Button`, `Card`.
**Feeds:** task 05 imports `src/lib/plans.ts`. Land this first if you can.

## Purpose

Explain the plans and start a trial. Public route.

## Prices are not locked

The handoff is explicit: the commercial model is a recommendation the client has not
approved. Confirm before shipping. Put every number in `src/lib/plans.ts` so a price
change is one edit, not a search across two screens:

```ts
// src/lib/plans.ts — single source of truth for pricing across /pricing and /checkout
// Sales tax is NOT a constant — see below. This is an illustrative fallback only.
export const ILLUSTRATIVE_TAX_RATE = 0.08875 // NYC combined
export const PLANS = [ /* free, pro, team */ ]
```

Pro is quoted as "$7 per month, billed yearly", which is $84 charged annually — task 05
depends on that figure. Derive it, do not restate it.

## Layout

`#f7f7f7`, 48px top padding, centred.

- Headline "Start free. Upgrade when your receipts pile up." (28px/700/`-0.02em`).
- Sub, 15px `#71717a`, max 460px: "No card needed to try it. Cancel in two clicks, and
  your receipts stay downloadable either way."

Three plan cards 32px below, 16px gap. Each: `flex: 1; min-width: 240px; max-width:
320px`, white, 12px radius, 24px padding, column with 14px gap, CTA pinned to the bottom
via `margin-top: auto`.

> **`box-sizing: border-box` is required here.** Without it the cards' padding pushes the
> row to wrap at desktop width. Tailwind preflight sets it globally — verify it is
> actually applying before you debug anything else about the wrap behaviour.

| | Free | Pro | Team |
|---|---|---|---|
| Sub | For the occasional receipt | For freelancers and one-person businesses | When someone else has to approve it |
| Price | $0 forever | $7 per month, billed yearly | $11 per person, per month |
| Features | 10 receipts a month; Automatic merchant and total; Monthly summary | Unlimited receipts; CSV and Excel export; Custom categories and tax rates; Search across every year | Everything in Pro; Shared workspace and approvals; Accountant access, read-only; Data processing agreement on request |
| CTA | "Current plan", disabled outline | "Start 14-day trial", primary | "Add your team", outlined `#18181b` |

Pro carries a **1.5px `#18181b` border** and a pill badge overlapping its top edge
(`top: -11px; left: 24px`, `#18181b` bg, 11px uppercase white text, `0.04em` tracking):
"Most people pick this". The card needs `position: relative` and must not clip the
badge.

Both active CTAs go to `/checkout`. There is no billing backend — task 05 renders a
UI-only checkout.

"Current plan" is disabled unconditionally in this branch (there is no subscription
state to read yet). Note that in the PR.

## Statements below the cards

Centred row, 12px `#71717a`, 8px/24px gaps. All three must be present **before**
checkout, verbatim:

- Prices exclude sales tax, added at checkout where applicable
- Cancel any time, keeps working until the period ends
- 14 days to change your mind, full refund

## Monthly/yearly toggle

Not designed. **Do not add one in this branch.** If it is added later it must show the
monthly-equivalent price *and* the total charged, and must never silently default to the
more expensive option.

## Responsive

Verify at 1080, **~900px (must stay 3-up)**, 768 and 420px. The ~900px case is the one
that breaks — it is why `box-sizing` is called out above. Cards stack at mobile widths.

## Definition of done

- `npm run build` and `npm run lint` clean.
- Every price and feature string reads from `src/lib/plans.ts`.
- Three-up at 900px, stacked at 420px, Pro badge not clipped at any width.
- The three pre-checkout statements are present and verbatim.
- Both active CTAs reach `/checkout`.
- PR notes that prices are unconfirmed and that "Current plan" is hardcoded.
