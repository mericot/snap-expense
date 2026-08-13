# Agent brief — Task 05: Checkout (`/checkout`)

You are implementing **step 05, the final step**, of a six-step sequence that recreates a
design handoff in this codebase:

```
00 foundation  ✔ merged        01 landing  /            02 sign-in  /login
03 inbox       /receipts       04 pricing  /pricing
05 checkout    /checkout  ← you are here
```

**Tasks 00 and 04 must both be merged into `ui-improvements` before you start.** 00 built
the tokens, primitives and the stub `src/app/checkout/page.tsx`; **04 built
`src/lib/plans.ts`, which you import for every amount on this page.** A senior engineer
reviews your PR.

> **This is the highest-risk task in the set.** It is UI-only, but it renders payment
> terms that are a binding pre-contract disclosure, and it renders fields that must never
> handle a real card number. **Read both warnings before writing code.**

---

## Before you write any code

1. **Read `AGENTS.md`.** Next.js 16.2.12 has breaking changes — read
   `node_modules/next/dist/docs/` first.
2. **Read `docs/design-tasks/05-checkout.md`** and `docs/design-tasks/README.md`.
3. **Read `src/lib/plans.ts`** (from task 04) and `src/components/ui/` before writing.
4. Design reference: `design_handoff_snapexpense_paid/README.md` §"5. Checkout";
   prototype markup `SnapExpense App.dc.html` lines 252–297 (reference only).

### Market: USD / US — decided, do not revisit.

### Branching

**`main` is not to be touched.** `ui-improvements` is the integration branch.

Branch **`design/05-checkout`** off `ui-improvements`, in a git worktree.

**Precondition — verify before you branch:**

```bash
git cat-file -e ui-improvements:src/lib/plans.ts && echo OK || echo MISSING
```

If `MISSING`, task 04 has not merged — **stop and say so.** Do not create your own
`plans.ts`; you would be forking the pricing source of truth.

### Environment

- **`.env.local` is gitignored and will not exist in a fresh worktree.** Copy it from the
  main checkout — you need a session to test the prefilled email. Never commit it.
- Dev server on a **non-default port** (`npx next dev -p 3015`).
- **Never use bare `git stash` / `git stash pop`** — shared stack across worktrees.

---

## What you own

`src/app/checkout/page.tsx`. Nothing else. **Do not touch** `src/lib/plans.ts` (task 04
owns it — if it is missing something, say so in the PR), `layout.tsx`, `globals.css`,
`src/components/ui/*`, or other routes.

Authenticated route — unauthenticated visits redirect to `/login`.

---

## Warning 1 — card fields are not ours to build

The prototype shows card number, MM/YY and CVC as inline fields. In production these are
**payment-provider iframe fields (Stripe Elements or equivalent)**. Card numbers must
never touch our servers — the footer and this page's own copy both promise exactly that,
and breaking it breaks PCI scope.

There is no billing backend and no Stripe account wired up. So in this branch:

- Render the card block as a clearly-marked **non-functional placeholder** at the right
  dimensions — **not `<input>` elements that could accept and submit a card number.**
- **Do not add `@stripe/*` packages.**
- "Start trial" submits nothing. Disable it, or no-op with a visible note.
- Flag Stripe Elements integration as the follow-up.

Email, country and ZIP are ordinary fields — build those properly, real labels bound by
`id`, correct `autocomplete`.

## Warning 2 — every amount must be interpolated

Every number in the payment terms and the summary must come from the real subscription
being created. **Hardcoding them is the specific failure mode to avoid.** US state
automatic-renewal laws — California's ARL is strictest and effectively sets the national
bar, with New York and Illinois close behind — and the card networks all require the
renewal amount, the renewal date and the cancellation method to be disclosed clearly and
conspicuously **before** consent, with cancelling at least as easy as signing up. A stale
hardcoded figure is a misrepresentation.

Import from `src/lib/plans.ts` and compute the renewal date from trial start + 14 days.
The prototype's "March 19, 2026" and "$84.00" are **sample values** — do not paste them
in as literals.

---

## The page

40px/24px padding, two wrapping columns, 32px gap.

### Left column (max 420px) — the form

- Title "Set up your subscription" (22px/600).
- Sub, 13px `#71717a`: "Your card is not charged today. We will email you three days
  before the trial ends." *(That promise implies a scheduled email which does not exist —
  note it as a backend follow-up.)*
- Fields, 14px gap, labels 13px `#27272a`: **Email** (prefilled from the session) ·
  **Card details** (number, then MM/YY and CVC side by side, 10px gap — see warning 1) ·
  **Country and ZIP code** (country select + ZIP field).

> **The ZIP field replaces the EU version's VAT ID and is required, not optional** — it
> is what the tax calculation keys on. Recompute the summary when it changes.

- Primary "Start trial" button, full width.

### Payment terms

Beneath the button, 12px `#71717a`, line-height 1.6, verbatim except the interpolated
values:

> By starting the trial you agree to the [Terms of Service] and authorize snapExpense to
> charge $84.00 plus applicable sales tax on March 19, 2026, and every 12 months after
> that, until you cancel. Cancel any time from Settings and the plan runs to the end of
> the paid period. Full refund within 14 days of a charge — see the [refund policy]. Card
> details are handled by our payment processor; we never see or store your card number.

Links to `/legal/terms` and `/legal/refunds`.

> **Do not move this text behind a link, a disclosure toggle, or a tooltip** — it must be
> visible at the point of consent. Note it says "plus applicable sales tax" rather than
> naming a rate: it has to stay true for a customer in a state where the product is
> untaxed. Dates are US convention, month-first and spelled out. Also confirm the in-app
> cancel path actually exists before launch — the terms promise it.

### Right column (max 340px, `align-self: flex-start`) — summary card

`#fafafa`, 1px `#e4e4e7`, 12px radius, 20px padding.

- Title "snapExpense Pro, yearly".
- Line items, 13px, space-between: 14-day trial **$0.00** · Then per year **$84.00** ·
  Sales tax (8.875%) **$7.46**.
- Divider, then "Due today **$0.00**" at 14px/600 `#18181b`.
- Divider, then 12px `#71717a`: "Due March 19, 2026: **$91.46**. We will remind you
  first."

All amounts tabular-numeral aligned.

> **The 8.875% / $7.46 / $91.46 figures are illustrative only** — that is the NYC
> combined rate, shown so the line item has something concrete to render. Real values come
> from a tax engine once the ZIP is known. **Handle three cases in the component:** tax
> not yet computed (no ZIP entered), tax computed as zero (SaaS is untaxed in many states
> — show `$0.00` or hide the row, but keep the total honest), and tax computed as
> non-zero.

---

## Constraints

- **No new dependencies**, and specifically **no `@stripe/*`**.
- No icons. No hardcoded hex values — use task 00's tokens.
- Transitions ≤150ms, colour/opacity only.

## Verify before opening the PR

- [ ] `npm run build` and `npm run lint` clean
- [ ] **No card data can be entered or submitted anywhere.** Confirm the card block is
      not composed of real inputs
- [ ] No `@stripe/*` dependency added
- [ ] Every amount, date and interval derives from `src/lib/plans.ts` plus a computed
      renewal date — **grep your file for `84`, `7.46`, `91.46`, `8.875` and `March 19`
      and confirm none remain as literals**
- [ ] All three tax cases render correctly (no ZIP / zero / non-zero)
- [ ] Payment terms block present, verbatim, visible without any interaction, both links
      working
- [ ] Email prefills from the session; unauthenticated visit redirects to `/login`
- [ ] At 420px the summary card drops **below** the form
- [ ] Keyboard pass: every real field reachable and labelled; focus always visible
- [ ] Checked at 1080 / 768 / 420px

## Your PR description must contain

1. What you changed and why, ordered by importance.
2. **Explicit confirmation that no field can accept a card number**, and how you verified it.
3. The grep result showing no hardcoded amounts remain.
4. Every assumption where the spec was silent; every deviation, with reasoning.
5. Flags and follow-ups: Stripe Elements integration, the trial-ending email, the real
   tax engine keyed on ZIP, real subscription state, and the in-app cancel path the terms
   promise.
6. What you did not test, honestly.

Keep commits small. Open as a **draft PR against `ui-improvements`**. Never force-push,
never merge your own branch. If something genuinely ambiguous comes up, **stop and ask**
rather than guessing — this page makes legal promises.
