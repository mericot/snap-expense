# Handoff: snapExpense — landing, app inbox, pricing, checkout, and legal/trust footer

## Overview
snapExpense is a receipt-capture and expense-export tool. Users are mostly solo (freelancers, one-person businesses), with a team tier planned. This handoff covers five screens and the compliance surfaces that run across them: a persistent trust footer, a cookie consent banner, payment-specific terms at checkout, and an in-app receipt retention notice.

The commercial model shown here is a recommendation, not a decision the client has locked: Free (10 receipts/month) → Pro €7/mo billed yearly (unlimited receipts, CSV/Excel export, custom categories) → Team €11/person/mo (shared workspace, approvals, read-only accountant access, DPA on request). Confirm prices before shipping.

## About the design files
The files in this bundle are **design references created in HTML** — prototypes showing intended look and behavior, not production code to copy. `SnapExpense App.dc.html` is a streaming single-file design component; it opens directly in a browser. Screens are switched by an on-page pill nav (a prototype affordance only — in production these are routes). The task is to **recreate these designs in the target codebase's existing environment** (React, Vue, Svelte, whatever is in use) with its established patterns, component library and routing. If no environment exists yet, pick the appropriate framework and implement there.

`support.js` is the prototype runtime the HTML file needs to render locally. It has no production relevance.

`SnapExpense Sign-in - footer options.dc.html` shows three earlier explorations of the legal footer (minimal / trust-forward / progressive disclosure). Option **1b, trust-forward**, was chosen and is what appears in the main file. Kept for context only.

## Fidelity
**High-fidelity.** Colors, type sizes, spacing and copy are final-intent. Recreate closely, but substitute the codebase's existing tokens and components where they already express the same values. Copy should be used verbatim — the legal and privacy wording is deliberate and was reviewed with the client. It is not legal advice; have counsel confirm the retention periods, refund window and VAT handling match actual practice before launch.

Notable prototype-only shortcuts to replace with real implementations:
- Inputs are rendered as static `div`s with placeholder-colored text. Build real `<input>` elements with proper labels, `type`, `autocomplete`, and focus states.
- The pill nav at the top of the page and the Desktop/Mobile width toggle are prototype scaffolding. Delete both.
- Card fields are shown inline; in production these are payment-provider iframe fields (Stripe Elements or equivalent). Never let card numbers touch your servers — the footer and checkout copy both promise this.

---

## Design tokens

**Color**
| Role | Value |
|---|---|
| Page background (outside frame) | `#e8e8e8` |
| Surface, primary | `#ffffff` |
| Surface, recessed / hero / footer | `#f7f7f7`, `#fafafa` |
| Border, default | `#e4e4e7` |
| Border, stronger (buttons, dividers) | `#d4d4d8` |
| Text, primary | `#18181b` |
| Text, secondary | `#3f3f46`, `#52525b` |
| Text, tertiary / meta | `#71717a` |
| Text, faint / placeholder | `#a1a1aa`, `#c4c4c8` |
| Warning (needs attention status) | `#a16207` |
| Button primary bg / text | `#18181b` / `#ffffff` |

The palette is deliberately neutral and monochrome. There is no brand accent color. If one is introduced later, keep it out of the legal footer.

**Typography** — system stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`, antialiased.

| Use | Size / weight / tracking |
|---|---|
| Hero headline | 44px / 700 / -0.03em / line-height 1.08 |
| Section heading | 28px / 700 / -0.02em |
| Screen title (e.g. "March 2026") | 22px / 600 / -0.01em |
| Wordmark, sign-in | 30px / 700 / -0.02em |
| Wordmark, app header | 17px / 700 / -0.01em |
| Feature/step title | 17px / 600 |
| Body large (hero sub) | 17px / 400 / line-height 1.55 |
| Body | 14–15px / 400 / line-height 1.5–1.6 |
| Meta, footer, legal | 12–13px / 400 / line-height 1.45–1.6 |
| Eyebrow (uppercase label) | 13px / 600 / 0.08em / uppercase / `#a1a1aa` |
| Badge (compliance chips) | 11px / 400 |

Numeric columns (amounts, step numbers) use `font-variant-numeric: tabular-nums`. Headlines and long body use `text-wrap: pretty`.

**Spacing** — 4px base. Common: 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 56, 64, 72.

**Radius** — 4px (thumbnails, badges), 7px (small buttons), 8px (inputs, primary buttons), 10px (cards, list containers), 12px (plan cards, hero image), 999px (pills, avatars).

**Borders and shadows** — 1px solid throughout; the emphasized Pro plan card uses 1.5px `#18181b`. Only two shadows exist: the cookie banner (`0 -8px 24px rgba(0,0,0,0.06)`) and the sticky nav's `backdrop-filter: blur(8px)` over `rgba(255,255,255,0.9)` (prototype scaffolding — drop it).

**Global** — `box-sizing: border-box` on everything. Links: `#52525b`, hover `#18181b`.

---

## Screens

### 1. Landing page (`home`) — default route `/`

**Purpose:** First thing a logged-out visitor sees. Explain what the product does, get them to a free account.

**Layout:** Full-width single column, sections stacked, max content width 1080px, alternating white and `#f7f7f7` backgrounds.

- **Header** — 16px/32px padding, bottom border `#e4e4e7`. Wordmark left; right cluster: "How it works", "Pricing", "Privacy", "Sign in" (`#18181b`), then a primary "Try it free" button (`#18181b` bg, 8px/14px padding, 7px radius, 13px).
- **Hero** — 72px top / 64px bottom padding, `#f7f7f7`, two columns with 48px gap, wrapping. Left (max 480px): headline "Photograph the receipt. We do the rest." / sub-paragraph / button row ("Start free" primary, "See pricing" outlined) / reassurance line "No card to start · 10 receipts a month on the free plan" (13px, `#71717a`). Right (max 440px): 4:3 image slot — currently a diagonal-stripe placeholder with a monospace label reading "product shot — inbox with a receipt open". **Replace with a real product screenshot.**
- **How it works** — 64px padding, eyebrow "HOW IT WORKS", then a 3-column auto-fit grid (min 240px, 28px gap). Each: numeral 01/02/03 in `#a1a1aa`, 17px/600 title, 14px body. Titles: "Send it in", "We read it", "Export when asked".
- **Privacy section** — `#f7f7f7`, 56px padding, two columns 40px gap. Left: "Your receipts stay yours" + paragraph + underlined link "Read what we collect and why". Right: white card, 12px radius, 22px padding, three stacked items with 13px/600 titles: "Stored in the EU", "Export or delete, any time", "Every subprocessor listed".
- **Closing CTA** — 64px padding, centered: "Start with this month's shoebox", supporting line, "Start free" button.
- Then the global footer (below).

### 2. Sign in (`signin`) — `/login`

**Purpose:** Passwordless email sign-in.

**Layout:** `#f7f7f7` panel, 72px top padding, centered column. Wordmark 30px/700, subtitle "Sign in to manage your receipts" (15px `#71717a`, 8px below). Card: max 400px, white, 1px `#e4e4e7`, 10px radius, 24px padding, 28px below the subtitle. Contents: "Email" label (14px `#27272a`), input (8px radius, 11px/13px padding, 14px), primary "Send magic link" button (full width, 13px padding, 8px radius, 15px, 8px top margin), then consent microcopy centered at 12px `#71717a` line-height 1.5:

> We email you a one-time link. No password stored. See [Terms] and [Privacy Policy].

Both links underlined. The consent line lives **inside** the card, directly under the button — it must be visible at the moment of submission, not only in the footer.

**Behavior:** Submitting shows a "check your inbox" state (not yet designed — needed). Rate-limit link requests. The link itself should be single-use and short-lived; state the expiry in the email.

### 3. Receipt inbox (`inbox`) — `/receipts`, authenticated

**Purpose:** The main working screen. See the month's receipts, fix what needs fixing, export.

**Layout:** App header (16px/24px padding, bottom border): wordmark + nav ("Receipts" active `#18181b`, "Reports", "Settings" in `#71717a`, 14px, 16px gap) on the left; "Upgrade" outlined button and a 30px circular avatar (`#e4e4e7` bg, initials 12px `#52525b`) on the right.

Body, 24px padding, 20px gap between blocks:
1. **Month header row** — "March 2026" (22px/600) with meta line beneath: "12 receipts · €1,284.60 · 3 need a category" (13px `#71717a`). Right: "Export CSV" outlined and "Add receipt" primary, both 13px.
2. **Dropzone** — `#fafafa`, 1px dashed `#d4d4d8`, 10px radius, 18px/20px padding: "Drop a photo or PDF here — we read the merchant, date and total for you."
3. **Receipt list** — 1px `#e4e4e7`, 10px radius, clipped. Each row: 14px/18px padding, 16px gap, bottom border `#f4f4f5`. Left: 36×44 thumbnail (4px radius, stripe placeholder → real receipt thumbnail). Middle (flexes): merchant 14px/500 `#18181b`, meta line "18 Mar · Travel" 12px `#a1a1aa`. Then a status pill (12px, 1px `#e4e4e7`, 999px radius, 3px/9px) — "Ready" in `#71717a`, "Needs category" in `#a16207`. Right: amount, 14px, tabular numerals, 84px wide, right-aligned.
   Sample rows in the prototype: Bahn — Berlin to Leipzig / 18 Mar / Travel / €64.90 / Ready · Kaffeehaus Mitte / 17 Mar / Uncategorised / €12.40 / Needs category · Adobe Creative Cloud / 15 Mar / Software / €59.99 · Papierhaus Kreuzberg / 14 Mar / Supplies / €28.15 · Hotel Fürst — 2 nights / 11 Mar / Travel / €214.00.
4. **Quota row** — last row of the list container, `#fafafa`: "You have used 10 of 10 free receipts this month." with an underlined "See plans" on the right. This is the paywall touchpoint; keep it calm and factual, no modal interrupt.
5. **Retention notice** — bordered card, 16px/18px padding, 13px body: bold lead "How long we keep this." then "Receipt images and the data we read from them stay until you delete them, then sit in encrypted backups for 30 days before they are gone for good. Deleting your account removes everything." + link "Retention policy". **The 30-day figure must match your actual backup lifecycle.**

**States needed but not yet designed:** empty inbox, upload in progress, OCR failed, a single receipt detail/edit view.

### 4. Pricing (`pricing`) — `/pricing`

**Purpose:** Explain the plans and start a trial.

**Layout:** `#f7f7f7`, 48px top padding, centered. Headline "Start free. Upgrade when your receipts pile up." (28px/700), sub (15px `#71717a`, max 460px): "No card needed to try it. Cancel in two clicks, and your receipts stay downloadable either way."

Three plan cards, 32px below, 16px gap, each `flex: 1; min-width: 240px; max-width: 320px`, white, 12px radius, 24px padding, column with 14px gap, CTA pinned to the bottom via `margin-top: auto`. **`box-sizing: border-box` is required here** — without it the cards' padding pushes the row to wrap at desktop width.

| | Free | Pro | Team |
|---|---|---|---|
| Sub | For the occasional receipt | For freelancers and one-person businesses | When someone else has to approve it |
| Price | €0 forever | €7 per month, billed yearly | €11 per person, per month |
| Features | 10 receipts a month; Automatic merchant and total; Monthly summary | Unlimited receipts; CSV and Excel export; Custom categories and tax rates; Search across every year | Everything in Pro; Shared workspace and approvals; Accountant access, read-only; Data processing agreement on request |
| CTA | "Current plan", disabled outline | "Start 14-day trial", primary | "Add your team", outlined `#18181b` |

The Pro card carries a 1.5px `#18181b` border and a pill badge overlapping its top edge (`top: -11px; left: 24px`, `#18181b` bg, 11px uppercase white text, 0.04em tracking): "Most people pick this".

Below the cards, a centered 12px `#71717a` row with 8px/24px gaps — three statements that must be present before checkout:
- Prices exclude VAT, added at checkout
- Cancel any time, keeps working until the period ends
- 14 days to change your mind, full refund

A monthly/yearly toggle is not designed yet; if you add one, show the monthly-equivalent price and the total charged, and never default to the more expensive option silently.

### 5. Checkout (`checkout`) — `/checkout`

**Purpose:** Collect payment details and start the trial.

**Layout:** 40px/24px padding, two wrapping columns, 32px gap. Left column (max 420px) is the form; right column (max 340px, `align-self: flex-start`) is the order summary.

**Left:** Title "Set up your subscription" (22px/600), sub (13px `#71717a`): "Your card is not charged today. We will email you three days before the trial ends." Fields, 14px gap, labels 13px `#27272a`: Email (prefilled from the session) · Card details (number, then MM/YY and CVC side by side, 10px gap) · Country and VAT ID (country select + optional VAT field). Primary "Start trial" button, full width.

Beneath the button, the payment terms block — 12px, `#71717a`, line-height 1.6, verbatim:

> By starting the trial you agree to the [Terms of Service] and authorise snapExpense to charge €84.00 plus VAT on 19 March 2026, and every 12 months after that, until you cancel. Cancel any time from Settings and the plan runs to the end of the paid period. Full refund within 14 days of a charge — see the [refund policy]. Card details are handled by our payment processor; we never see or store your card number.

Amount, date and interval must be interpolated from the real subscription being created, not hardcoded. EU consumer law and the card networks both expect the renewal amount and date to be stated before consent — do not move this text behind a link.

**Right (summary card):** `#fafafa`, 1px `#e4e4e7`, 12px radius, 20px padding. Title "snapExpense Pro, yearly". Line items (13px, space-between): 14-day trial €0.00 · Then per year €84.00 · VAT (19%) €15.96. Divider, then "Due today €0.00" at 14px/600 `#18181b`. Divider, then 12px `#71717a`: "Due 19 March 2026: €99.96. We will remind you first."

---

## Global footer (every screen)

Top border `#e4e4e7`, `#fafafa` background, 24px padding, 18px gap, three stacked bands:

1. **Four data-handling statements** — `repeat(auto-fit, minmax(180px, 1fr))` grid, 16px gap. Each: 12px/600 `#27272a` title + 12px `#71717a` body, line-height 1.45.
   - Receipt images — "Encrypted at rest. Deleted 30 days after you delete the expense."
   - Never sold — "No ad networks, no data brokers, no training on your receipts."
   - Your data, exportable — "Download or wipe everything from Settings, any time."
   - Payments — "Processed by our payment provider. We never store card numbers."
2. **Link row + compliance chips**, space-between, 12px. Links (6px/16px gap, no underline, `#71717a`): Privacy · Terms · Refunds · Cookies · DPA · Subprocessors · Imprint. Chips (11px, 1px `#e4e4e7`, 4px radius, 3px/7px): GDPR · CCPA · SOC 2 in progress.
3. **Copyright** — 12px `#a1a1aa`: "© 2026 snapExpense Inc. · Berlin, DE".

Each of the four claims is a commitment. If any becomes untrue — an analytics vendor that profiles, a model trained on receipt text, a longer backup window — the footer changes with it. "SOC 2 in progress" must come down or become "SOC 2 Type II" once the audit resolves; do not leave it in limbo. Imprint is required for a German entity (§5 DDG); DPA and Subprocessors pages must actually exist before Team ships.

## Cookie consent banner

Sticky to the bottom of the viewport, white, top border `#d4d4d8`, shadow `0 -8px 24px rgba(0,0,0,0.06)`, 16px/24px padding, space-between with 14px gap.

Left, 13px `#52525b`, max 520px: "We use cookies that keep you signed in, and nothing else unless you say yes. Analytics helps us see which features get used." + underlined "Cookie policy".

Right, three buttons, 8px gap: "Essential only" (outlined), "Choose" (outlined), "Accept all" (primary). Reject must be as easy to reach as accept — that is why all three sit at the same level with equal weight; do not demote "Essential only" to a text link, and do not style "Accept all" larger.

**Behavior:** shows on first visit; the choice persists (cookie or localStorage, one year); no non-essential script fires until a choice is recorded; "Choose" opens a per-category panel (not yet designed — needed); the choice is revisitable from the footer's "Cookies" link.

---

## Interactions and behavior

**Navigation flows implemented in the prototype:** landing "Start free"/"Try it free" → sign in · sign in "Send magic link" → inbox (stands in for the emailed link) · landing/inbox "Pricing"/"Upgrade"/"See plans" → pricing · pricing "Start 14-day trial"/"Add your team" → checkout.

**Hover:** outlined buttons and the "Upgrade" chip shift border to `#18181b`. Footer/nav links go `#52525b` → `#18181b`. Nothing else animates; there are no transitions, motion or loading animations in this design. Add whatever the codebase's convention is, kept short (≤150ms) and confined to color and opacity.

**Responsive:** every multi-column block is `flex-wrap: wrap` or `auto-fit` grid, so the layout collapses to a single column naturally. Verify at 1080px (desktop), ~900px (pricing must stay 3-up), 768px and 420px (mobile: hero stacks with copy first, plan cards stack, checkout summary drops below the form, footer statements go 1–2 up). The prototype's Desktop/Mobile toggle exists only to preview these; remove it.

**Accessibility, not covered in the mock but required:** real labels bound to inputs; visible focus rings (the design has none — add one that reads at 3:1 against `#fff` and `#fafafa`); the cookie banner as a focus-trapped dialog or at minimum announced and reachable; status pills need text alternatives, not color alone (they already carry text — keep it); minimum 44px touch targets on mobile, which several 13px/8px-padded buttons currently miss.

## State

| State | Where | Notes |
|---|---|---|
| `screen` | prototype only | Replace with routes. |
| `narrow` | prototype only | Delete; use CSS. |
| `cookiesOpen` | global | Persist the decision, not the banner. Default open only when no decision is stored. |
| session / user | app-wide | Email, avatar initials, plan. |
| receipts | inbox | Fetched per month: merchant, date, category, amount, status (`ready` \| `needs_category`), thumbnail URL. |
| usage quota | inbox, header | Count vs. plan limit; drives the quota row and Upgrade affordance. |
| subscription | pricing, checkout, settings | Plan, interval, renewal date, renewal amount, currency, VAT rate — checkout copy interpolates all of these. |

## Assets
No production assets exist yet. Two placeholders need real files:
- Landing hero, 4:3 — product screenshot of the inbox with a receipt open.
- Receipt row thumbnails, 36×44 — generated from the uploaded image.

No icons are used anywhere in this design; it is text-only by choice. If the codebase has an icon set, adding icons is a design decision to run past the client rather than a gap to fill.

## Files in this bundle
- `SnapExpense App.dc.html` — all five screens, the footer, and the cookie banner. Open in a browser; use the pill nav to move between screens.
- `SnapExpense Sign-in - footer options.dc.html` — three footer explorations; 1b was chosen. Reference only.
- `support.js` — prototype runtime required by both HTML files. Not for production.
