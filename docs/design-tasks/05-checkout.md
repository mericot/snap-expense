# Task 05 — Checkout (`/checkout`)

**Branch:** `design/05-checkout` off `ui-improvements` (after task 00 has merged)
**Owns:** `src/app/checkout/page.tsx`
**Reference:** `design_handoff_snapexpense_paid/README.md` §"5. Checkout".
Prototype markup: `SnapExpense App.dc.html` lines 252–297.
**Depends on:** task 00 tokens and primitives; `src/lib/plans.ts` from task 04.

The highest-risk task in the set. It is UI-only, but it renders payment terms that are a
binding pre-contract disclosure, and it renders fields that must never handle a real card
number. Read both warnings below before writing code.

## Purpose

Collect payment details and start the trial. Authenticated route.

## Warning 1 — card fields are not ours to build

The prototype shows card number, MM/YY and CVC as inline fields. In production these are
**payment-provider iframe fields (Stripe Elements or equivalent)**. Card numbers must
never touch our servers — the footer and the checkout copy both promise exactly that,
and breaking it breaks PCI scope.

There is no billing backend and no Stripe account wired up. So in this branch:

- Render the card block as a clearly-marked, **non-functional placeholder** at the right
  dimensions — not `<input>` elements that could accept and submit a card number.
- Do not add `@stripe/*` packages.
- "Start trial" does not submit anything. Disable it, or have it no-op with a visible
  note.
- Flag Stripe Elements integration as the follow-up.

Email, country and VAT ID are ordinary fields — build those properly with real labels
and `autocomplete`.

## Warning 2 — the amounts must be interpolated

Every number in the payment terms and the summary must come from the real subscription
being created. **Hardcoding them is the specific failure mode to avoid** — EU consumer
law and the card networks both require the actual renewal amount and date to be shown
before consent, and a stale hardcoded figure is a misrepresentation.

Import from `src/lib/plans.ts` (task 04) and compute the renewal date from trial start +
14 days. The prototype's "19 March 2026" and "€84.00" are sample values; do not paste
them in as literals.

## Layout

40px/24px padding, two wrapping columns, 32px gap.

**Left column** (max 420px) — the form:

- Title "Set up your subscription" (22px/600).
- Sub, 13px `#71717a`: "Your card is not charged today. We will email you three days
  before the trial ends." (That promise implies a scheduled email — note it as a backend
  follow-up, it does not exist.)
- Fields, 14px gap, labels 13px `#27272a`: Email (prefilled from the session) · Card
  details (number, then MM/YY and CVC side by side, 10px gap — see warning 1) · Country
  select and optional VAT ID.
- Primary "Start trial" button, full width.

**Payment terms**, beneath the button, 12px `#71717a`, line-height 1.6, verbatim except
for the three interpolated values:

> By starting the trial you agree to the [Terms of Service] and authorise snapExpense to
> charge €84.00 plus VAT on 19 March 2026, and every 12 months after that, until you
> cancel. Cancel any time from Settings and the plan runs to the end of the paid period.
> Full refund within 14 days of a charge — see the [refund policy]. Card details are
> handled by our payment processor; we never see or store your card number.

Amount, date and interval are interpolated. Links to `/legal/terms` and
`/legal/refunds`. **Do not move this text behind a link, a disclosure toggle, or a
tooltip** — it must be visible at the point of consent.

**Right column** (max 340px, `align-self: flex-start`) — summary card: `#fafafa`, 1px
`#e4e4e7`, 12px radius, 20px padding.

- Title "snapExpense Pro, yearly".
- Line items, 13px, space-between: 14-day trial €0.00 · Then per year €84.00 ·
  VAT (19%) €15.96.
- Divider, then "Due today €0.00" at 14px/600 `#18181b`.
- Divider, then 12px `#71717a`: "Due 19 March 2026: €99.96. We will remind you first."

All amounts tabular-numeral aligned. The VAT figure and the total are computed
(`84.00 × 0.19 = 15.96`; `84.00 + 15.96 = 99.96`) — derive them from `VAT_RATE`, and
note that the rate is actually a function of the customer's country, which the country
select above implies but this branch does not implement.

## Responsive

At 420px the summary card drops **below** the form. Verify at 1080, 768 and 420px.

## Definition of done

- `npm run build` and `npm run lint` clean.
- No card data can be entered or submitted anywhere. No `@stripe/*` dependency added.
- Every amount, date and interval derives from `src/lib/plans.ts` plus a computed
  renewal date — grep the file for hardcoded `84`, `15.96`, `99.96` and `19 March` and
  confirm none remain.
- Payment terms block present, verbatim, visible without interaction, links working.
- Email prefills from the session; unauthenticated visit redirects to `/login`.
- Checked at 1080 / 768 / 420px.
- PR lists the follow-ups: Stripe Elements, the trial-ending email, country-based VAT,
  and real subscription state.
