# Design handoff → branch plan

Breaks `design_handoff_snapexpense_paid/` into six independently reviewable branches,
one per screen, so each can be handed to its own agent and tested in isolation.

Source of truth for design intent: `design_handoff_snapexpense_paid/README.md`
(read it in full before starting any task — it carries verbatim legal copy that must
not be paraphrased). The prototype markup is
`design_handoff_snapexpense_paid/SnapExpense App.dc.html`; line ranges per screen are
given in each task file. That file uses a prototype template syntax (`{{ }}`,
`style-hover`, `<sc-if>`) and is **reference only** — never copy it into `src/`.

## ⚠ Read first: `ui-improvements` is stale

At the time of writing, `ui-improvements` is **0 commits ahead of `origin/main` and 21
behind it**. Everything on it is already merged; it is an old pointer, not live work.
Those 21 commits are not cosmetic — they include authentication on `/api/extract`,
per-user rate limiting, a body-size limit, the Vercel prerender fixes, `next` 16.2.9 →
16.2.12, and a move to the cookie-based `@supabase/ssr` client
(`src/lib/supabase-server.ts`).

**Branching the design work off `ui-improvements` as it stands would silently revert all
of that.** Fast-forward it first — it is 0 ahead, so nothing is lost:

```bash
git checkout ui-improvements
git merge --ff-only origin/main
git push -u origin ui-improvements
```

Every instruction below assumes that has happened. If you would rather retire the branch
and base the design work directly on `main`, that works too — just substitute `main`
throughout.

The UI files these tasks touch (`src/app/page.tsx`, `layout.tsx`, `globals.css`) are
**identical** on both branches, so the task content itself is unaffected either way.

## Branch order

Task 00 is a hard prerequisite. It creates the design tokens, shared primitives, the
global footer, the cookie banner, and empty route stubs for every screen. **Merge 00
into `ui-improvements` before cutting 01–05.** Once it lands, tasks 01–05 each touch a
disjoint set of files and can run in parallel without conflicting.

```
ui-improvements
  └── design/00-foundation        ← merge back into ui-improvements first
        ├── design/01-landing     /            (parallel)
        ├── design/02-signin      /login       (parallel)
        ├── design/03-inbox       /receipts    (parallel, largest)
        ├── design/04-pricing     /pricing     (parallel)
        └── design/05-checkout    /checkout    (parallel, depends on 04's price config)
```

| # | Branch | Route | Task file | Size | New files owned |
|---|---|---|---|---|---|
| 00 | `design/00-foundation` | — | [00-foundation.md](00-foundation.md) | M | tokens, `src/components/ui/*`, `Footer`, `CookieBanner`, route stubs |
| 01 | `design/01-landing` | `/` | [01-landing.md](01-landing.md) | M | `src/app/page.tsx` |
| 02 | `design/02-signin` | `/login` | [02-signin.md](02-signin.md) | S | `src/app/login/page.tsx` |
| 03 | `design/03-inbox` | `/receipts` | [03-inbox.md](03-inbox.md) | L | `src/app/receipts/*` |
| 04 | `design/04-pricing` | `/pricing` | [04-pricing.md](04-pricing.md) | S | `src/app/pricing/page.tsx`, `src/lib/plans.ts` |
| 05 | `design/05-checkout` | `/checkout` | [05-checkout.md](05-checkout.md) | M | `src/app/checkout/page.tsx` |

Cut each branch from `ui-improvements` **after** 00 has merged:

```bash
git checkout ui-improvements && git pull
git checkout -b design/01-landing
```

## Rules that apply to every task

1. **Read `node_modules/next/dist/docs/` before writing code.** Per `AGENTS.md`, this
   Next.js version (16.2.12) has breaking changes versus what you may remember.
2. **Legal and privacy copy is verbatim.** Footer statements, the sign-in consent line,
   the retention notice, the checkout payment terms and the cookie banner text were
   reviewed with the client. Reproduce them character for character. Do not "improve"
   the wording.
3. **Use the tokens from task 00.** Do not hardcode hex values in page components. If a
   token you need is missing, add it in a small commit and say so in the PR.
4. **No new dependencies** without flagging it in the PR description. No icon library —
   the design is text-only by choice (handoff README, "Assets").
5. **Replace prototype shortcuts.** Static `div`s standing in for inputs become real
   `<input>`/`<select>` with bound `<label>`, `type`, `autocomplete` and a visible focus
   ring. The pill nav and the Desktop/Mobile toggle in the prototype are scaffolding —
   do not port them.
6. **Accessibility is in scope, not a follow-up.** Visible focus rings at ≥3:1 against
   `#fff` and `#fafafa`; 44px minimum touch targets on mobile; status conveyed by text
   as well as colour.
7. **Verify at 1080, ~900, 768 and 420px** before opening the PR. Pricing must stay 3-up
   at ~900px.
8. Run `npm run build` and `npm run lint` clean before requesting review.

## Open decisions — flagged, not resolved

These affect more than one branch. Each task file states the assumption it proceeds
under so work is not blocked; confirm before launch.

- **Currency.** The app currently formats amounts as USD (`$`, `fmt()` in
  `src/app/page.tsx`). The design is entirely EUR with a Berlin entity and a 19% VAT
  line. *Assumption: adopt EUR app-wide.* This changes existing stored-data display.
- **Prices are a recommendation, not locked.** The handoff README says so explicitly.
  €0 / €7 mo billed yearly (€84/yr) / €11 per person. Task 04 centralises these in
  `src/lib/plans.ts` so one edit changes every screen.
- **Retention window.** The footer and the inbox retention notice both promise 30 days.
  Must match the real Supabase backup lifecycle before launch, or the copy changes.
- **"SOC 2 in progress" chip.** Only ship this if the audit is genuinely underway.
- **Legal pages do not exist.** The footer links to Privacy, Terms, Refunds, Cookies,
  DPA, Subprocessors and Imprint. Task 00 wires them as real hrefs to `/legal/*`;
  those pages are a separate piece of work and must exist before Team ships (Imprint is
  required for a German entity under §5 DDG).
- **No billing backend.** Tasks 04 and 05 are UI-only. Card fields are Stripe Elements
  in production and must never be plain inputs that touch our servers — task 05 renders
  a clearly-marked placeholder, not a working card form.
