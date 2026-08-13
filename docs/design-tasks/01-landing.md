# Task 01 — Landing page (`/`)

**Branch:** `design/01-landing` off `ui-improvements` (after task 00 has merged)
**Owns:** `src/app/page.tsx` and any `src/components/landing/*` you add
**Reference:** `design_handoff_snapexpense_paid/README.md` §"1. Landing page".
Prototype markup: `SnapExpense App.dc.html` lines 34–116.
**Depends on:** task 00 tokens, `Button`, `Card`, `Eyebrow`, and the global footer.

## Purpose

The first thing a logged-out visitor sees. Explain the product, get them to a free
account. Public route — a signed-in visitor should be redirected to `/receipts` (the
session gate from task 00 handles this).

## Layout

Full-width single column, sections stacked, max content width 1080px, alternating white
and `#f7f7f7` backgrounds.

**Header** — 16px/32px padding, bottom border `#e4e4e7`. Wordmark left. Right cluster:
"How it works", "Pricing", "Privacy", "Sign in" (`#18181b`), then a primary "Try it
free" button (13px, `sm` size). "Pricing" → `/pricing`, "Sign in" and "Try it free" →
`/login`, "How it works" → the on-page section anchor, "Privacy" → `/legal/privacy`.

The prototype's sticky nav uses `backdrop-filter: blur(8px)` over
`rgba(255,255,255,0.9)`. The handoff marks this as scaffolding — **drop it**, the header
is not sticky.

**Hero** — 72px top / 64px bottom padding, `#f7f7f7`, two columns, 48px gap, wrapping.

- Left (max 480px): headline "Photograph the receipt. We do the rest." (44px / 700 /
  `-0.03em` / line-height 1.08, `text-wrap: pretty`); sub-paragraph (17px / 400 /
  line-height 1.55); button row — "Start free" primary and "See pricing" outline
  (`md` size); then the reassurance line at 13px `#71717a`: "No card to start · 10
  receipts a month on the free plan".
- Right (max 440px): 4:3 image slot. The prototype shows a diagonal-stripe placeholder
  with a monospace label reading "product shot — inbox with a receipt open".
  **No real asset exists yet.** Build the slot at the right aspect ratio and keep the
  placeholder; flag in the PR that a screenshot of the inbox with a receipt open is
  needed. Do not ship the placeholder to production.

**How it works** — 64px padding, eyebrow "HOW IT WORKS", then a
`repeat(auto-fit, minmax(240px, 1fr))` grid, 28px gap. Each cell: numeral 01/02/03 in
`#a1a1aa` (tabular numerals), 17px/600 title, 14px body. Titles: "Send it in",
"We read it", "Export when asked". Body copy is in the prototype — take it verbatim.

**Privacy section** — `#f7f7f7`, 56px padding, two columns, 40px gap. Left: "Your
receipts stay yours" (28px/700/`-0.02em`) + paragraph + underlined link "Read what we
collect and why" → `/legal/privacy`. Right: white card, 12px radius, 22px padding,
three stacked items with 13px/600 titles: "Stored in the EU", "Export or delete, any
time", "Every subprocessor listed".

**Closing CTA** — 64px padding, centred: "Start with this month's shoebox", supporting
line, "Start free" button → `/login`.

Then the global footer, which `layout.tsx` already renders. Do not add a second one.

## Notes and constraints

- Copy in the privacy section is a commitment, same as the footer. "Stored in the EU"
  and "Every subprocessor listed" must be true, and the subprocessors page must exist
  before this claim is public.
- Hover: outlined buttons shift border to `#18181b`; nav links `#52525b` → `#18181b`.
  Nothing else animates.
- No icons anywhere — this design is text-only by choice.

## Responsive

Every multi-column block is `flex-wrap: wrap` or an auto-fit grid, so it collapses
naturally. Verify at 1080, 768 and 420px. At 420px the hero stacks **copy first**,
image second — check the source order gives you that without a CSS reorder hack.

## Definition of done

- `npm run build` and `npm run lint` clean.
- Signed-out visit to `/` renders the full page; signed-in visit redirects to
  `/receipts`.
- All links resolve to the routes above (legal links will 404 until those pages exist —
  expected, note it in the PR).
- Checked at 1080 / 768 / 420px.
- Headline, hero sub, and the "No card to start" line match the prototype verbatim.
