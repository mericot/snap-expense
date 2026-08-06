# Agent brief — Task 04: Pricing (`/pricing`)

You are implementing **step 04 of a six-step sequence** that recreates a design handoff
in this codebase:

```
00 foundation  ✔ merged        01 landing  /            02 sign-in  /login
03 inbox       /receipts       04 pricing  /pricing  ← you are here
05 checkout    /checkout
```

**Task 00 must already be merged into `ui-improvements`.** It built the tokens, the
primitives (`Button`, `Card`), the global footer, and a stub `src/app/pricing/page.tsx`
reserved for you. **A senior engineer reviews your PR.**

> **Task 05 imports the file you create here** (`src/lib/plans.ts`). Land this before 05
> starts, and treat that module as a public contract — 05's checkout totals are computed
> from it.

---

## Before you write any code

1. **Read `AGENTS.md`.** Next.js 16.2.12 has breaking changes — read
   `node_modules/next/dist/docs/` first.
2. **Read `docs/design-tasks/04-pricing.md`** and `docs/design-tasks/README.md`.
3. **Read what task 00 built** — `src/app/globals.css` for tokens,
   `src/components/ui/` for primitive APIs. `Button` already supports a `disabled`
   outline variant; you need it.
4. Design reference: `design_handoff_snapexpense_paid/README.md` §"4. Pricing";
   prototype markup `SnapExpense App.dc.html` lines 192–251 (reference only).

### Market: USD / US — decided, do not revisit.

### Branching

**`main` is not to be touched.** `ui-improvements` is the integration branch.

Branch **`design/04-pricing`** off `ui-improvements`, in a git worktree.

**Precondition — verify before you branch:**

```bash
git cat-file -e ui-improvements:src/components/ui/Card.tsx && echo OK || echo MISSING
```

If `MISSING`, task 00 has not merged — **stop and say so.**

### Environment

- **`.env.local` is gitignored and will not exist in a fresh worktree.** Copy it from the
  main checkout. Never commit it.
- Dev server on a **non-default port** (`npx next dev -p 3014`).
- **Never use bare `git stash` / `git stash pop`** — shared stack across worktrees.

---

## What you own

`src/app/pricing/page.tsx` and `src/lib/plans.ts`. Nothing else. **Do not touch**
`layout.tsx`, `globals.css`, `src/components/ui/*`, or other routes.

Public route.

---

## Prices are not locked

The handoff is explicit: the commercial model is a **recommendation the client has not
approved**, and the USD figures are *numeral parity* with the original EU draw
(€7 → $7), **not an FX conversion**. Confirm before shipping — and put every number in
`src/lib/plans.ts` so a price change is one edit, not a search across two screens:

```ts
// src/lib/plans.ts — single source of truth for pricing across /pricing and /checkout
export const PLANS = [ /* free, pro, team */ ]
```

Pro is quoted as "$7 per month, billed yearly", which is **$84 charged annually** — task
05 depends on that figure. **Derive it, do not restate it.**

Sales tax does **not** belong in this module as a constant. US sales tax is
destination-based and SaaS is untaxed in many states; task 05 computes it from a ZIP. If
you export an illustrative rate for 05 to fall back on, name it so nobody mistakes it for
truth (`ILLUSTRATIVE_TAX_RATE`) and comment why.

---

## The page

`#f7f7f7`, 48px top padding, centred.

- Headline "Start free. Upgrade when your receipts pile up." (28px/700/`-0.02em`).
- Sub, 15px `#71717a`, max 460px:
  > No card needed to try it. Cancel in two clicks, and your receipts stay downloadable
  > either way.

Three plan cards 32px below, 16px gap. Each: `flex: 1; min-width: 240px; max-width:
320px`, white, 12px radius, 24px padding, column with 14px gap, **CTA pinned to the
bottom via `margin-top: auto`**.

> **`box-sizing: border-box` is required here.** Without it the cards' padding pushes the
> row to wrap at desktop width. Tailwind preflight sets it globally — **verify it is
> actually applying before you debug anything else about wrap behaviour.** This is the
> single most likely thing to waste your time on this page.

| | Free | Pro | Team |
|---|---|---|---|
| Sub | For the occasional receipt | For freelancers and one-person businesses | When someone else has to approve it |
| Price | $0 forever | $7 per month, billed yearly | $11 per person, per month |
| Features | 10 receipts a month; Automatic merchant and total; Monthly summary | Unlimited receipts; CSV and Excel export; Custom categories and tax rates; Search across every year | Everything in Pro; Shared workspace and approvals; Accountant access, read-only; Data processing agreement on request |
| CTA | "Current plan", disabled outline | "Start 14-day trial", primary | "Add your team", outlined `#18181b` |

**Pro** carries a **1.5px `#18181b` border** and a pill badge overlapping its top edge
(`top: -11px; left: 24px`, `#18181b` bg, 11px uppercase white text, `0.04em` tracking):
**"Most people pick this"**. The card needs `position: relative` and **must not clip the
badge**.

Both active CTAs → `/checkout`. There is no billing backend; 05 is UI-only.

"Current plan" is disabled unconditionally in this branch — there is no subscription
state to read yet. Note that in the PR.

### Statements below the cards

Centred row, 12px `#71717a`, 8px/24px gaps. All three must be present **before**
checkout, verbatim:

- Prices exclude sales tax, added at checkout where applicable
- Cancel any time, keeps working until the period ends
- 14 days to change your mind, full refund

> **"where applicable" is load-bearing** — SaaS is not taxable in every state, so two
> customers on the same plan can legitimately see different totals. Do not trim it.
>
> The 14-day refund is a **policy choice, not a statutory right** — the EU's withdrawal
> period does not apply to a US entity selling to US customers. Keep the window if the
> client wants it, but never describe it anywhere as a legal requirement.

### Monthly/yearly toggle

Not designed. **Do not add one in this branch.** If added later it must show the
monthly-equivalent price *and* the total charged, and must never silently default to the
more expensive option.

---

## Constraints

- **No new dependencies.** No icons. No hardcoded hex values — use task 00's tokens.
- No price, feature string or rate hardcoded in the page — all of it from `plans.ts`.
- Transitions ≤150ms, colour/opacity only.

## Verify before opening the PR

- [ ] `npm run build` and `npm run lint` clean
- [ ] **Three-up at ~900px** (the case that breaks), stacked at 420px
- [ ] Pro badge not clipped at **any** width
- [ ] Every price and feature string reads from `src/lib/plans.ts` — grep the page for
      `$7`, `$84`, `$11` and confirm none are literals
- [ ] The three pre-checkout statements present and verbatim
- [ ] Both active CTAs reach `/checkout`; "Current plan" is genuinely non-interactive
- [ ] Keyboard pass: the disabled CTA must not be a tab trap; focus always visible
- [ ] 44px touch targets at 420px
- [ ] Checked at 1080 / 900 / 768 / 420px

## Your PR description must contain

1. What you changed and why, ordered by importance.
2. **The shape of `src/lib/plans.ts`** — task 05 consumes it, so the reviewer needs to
   see the contract.
3. Every assumption where the spec was silent; every deviation, with reasoning.
4. Flags: prices are unconfirmed and are numeral-parity not FX; "Current plan" is
   hardcoded; no monthly/yearly toggle; the refund window is a policy choice.
5. What you did not test, honestly.

Keep commits small. Open as a **draft PR against `ui-improvements`**. Never force-push,
never merge your own branch. If something genuinely ambiguous comes up, **stop and ask**.
