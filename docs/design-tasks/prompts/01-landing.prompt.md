# Agent brief — Task 01: Landing page (`/`)

You are implementing **step 01 of a six-step sequence** that recreates a design handoff
in this codebase:

```
00 foundation  ✔ merged        01 landing  /   ← you are here
02 sign-in     /login          03 inbox    /receipts
04 pricing     /pricing        05 checkout /checkout
```

**Task 00 must already be merged into `ui-improvements` before you start.** It built the
design tokens, the shared primitives (`Button`, `Card`, `Eyebrow`), the global footer,
the cookie banner, and a stub `src/app/page.tsx` reserved for you. **A senior engineer
reviews your PR.** Optimise for a diff that is easy to read and easy to disagree with.

---

## Before you write any code

1. **Read `AGENTS.md`.** This is Next.js 16.2.12 with breaking changes versus what you
   may remember. Read the relevant guide in `node_modules/next/dist/docs/` before
   writing routes or components.
2. **Read `docs/design-tasks/01-landing.md`** (your detailed spec) and
   `docs/design-tasks/README.md` (rules across all six tasks).
3. **Read what task 00 built** before writing a line — `src/app/globals.css` for the
   token names, and `src/components/ui/` for the primitives' actual APIs. Do not guess
   at prop names, and do not build a second Button.
4. Design reference: `design_handoff_snapexpense_paid/README.md` §"1. Landing page";
   prototype markup `SnapExpense App.dc.html` lines 34–116 (reference only — never copy
   it into `src/`, it uses a prototype template syntax).

### Market: USD / US — decided, do not revisit.

### Branching

**`main` is not to be touched** — no commits, no pushes, no PRs against it.
`ui-improvements` is the integration branch.

Branch **`design/01-landing`** off `ui-improvements`, in a git worktree.

**Precondition — verify before you branch:**

```bash
git cat-file -e ui-improvements:src/components/ui/Button.tsx && echo OK || echo MISSING
```

If `MISSING`, task 00 has not merged yet — **stop and say so.** Do not build your own
tokens or primitives to work around it; that is precisely the conflict this sequence
exists to prevent.

### Environment

- **`.env.local` is gitignored and will not exist in a fresh worktree.** Copy it from
  the main checkout. Never commit it or hardcode the keys.
- Dev server on a **non-default port** (`npx next dev -p 3011`) — other agents may hold
  3000, and you will otherwise screenshot someone else's app.
- **Never use bare `git stash` / `git stash pop`** — the stash stack is shared across
  worktrees and you can destroy another agent's work. Use a WIP commit.

---

## What you own

`src/app/page.tsx`, plus any `src/components/landing/*` you add. Nothing else.

**Do not touch** `layout.tsx`, `globals.css`, `src/components/ui/*`, `Footer.tsx`,
`CookieBanner.tsx`, or any other route. If a token or a primitive variant is genuinely
missing, say so in the PR rather than editing task 00's files — five branches share them.

Public route. A signed-in visitor is redirected to `/receipts` by the session gate task
00 built; use it, don't reimplement it.

---

## The page

Full-width single column, sections stacked, **max content width 1080px**, alternating
white and `#f7f7f7` backgrounds. The global footer is already rendered by `layout.tsx` —
**do not add a second one.**

### Header
16px/32px padding, bottom border `#e4e4e7`. Wordmark left. Right cluster: "How it works",
"Pricing", "Privacy", "Sign in" (`#18181b`), then a primary "Try it free" button (13px,
`sm` size). Targets: "How it works" → on-page anchor, "Pricing" → `/pricing`, "Privacy" →
`/legal/privacy`, "Sign in" and "Try it free" → `/login`.

The prototype's sticky nav uses `backdrop-filter: blur(8px)` over
`rgba(255,255,255,0.9)`. The handoff marks that as scaffolding — **the header is not
sticky. Drop it.**

### Hero
72px top / 64px bottom padding, `#f7f7f7`, two columns, 48px gap, wrapping.

**Left (max 480px):**
- Headline, 44px / 700 / `-0.03em` / line-height 1.08, `text-wrap: pretty`:
  > Photograph the receipt. We do the rest.
- Sub-paragraph, 17px / 400 / line-height 1.55 (take the exact wording from the
  prototype).
- Button row: "Start free" primary → `/login`, "See pricing" outline → `/pricing`
  (`md` size).
- Reassurance line, 13px `#71717a`, verbatim:
  > No card to start · 10 receipts a month on the free plan

**Right (max 440px):** a 4:3 image slot. The prototype shows a diagonal-stripe
placeholder with a monospace label reading "product shot — inbox with a receipt open".

**No real asset exists.** Build the slot at the correct aspect ratio, keep the
placeholder, and flag in the PR that a screenshot of the inbox with a receipt open is
needed. Do not ship the placeholder to production, and do not substitute a stock image
or generate one.

### How it works
64px padding. Eyebrow "HOW IT WORKS", then a `repeat(auto-fit, minmax(240px, 1fr))` grid,
28px gap. Each cell: numeral 01/02/03 in `#a1a1aa` with **tabular numerals**, 17px/600
title, 14px body. Titles: **"Send it in"**, **"We read it"**, **"Export when asked"**.
Body copy verbatim from the prototype.

### Privacy section
`#f7f7f7`, 56px padding, two columns, 40px gap.

- **Left:** "Your receipts stay yours" (28px/700/`-0.02em`), paragraph, then an
  underlined link "Read what we collect and why" → `/legal/privacy`.
- **Right:** white card, 12px radius, 22px padding, three stacked items with 13px/600
  titles: **"Stored in the US"**, **"Export or delete, any time"**, **"Every
  subprocessor listed"**. The first item's body reads:
  > Northern Virginia, on servers we control the access to.

> **These are factual claims, not decoration.** "Stored in the US / Northern Virginia"
> must match where the data actually lives — change the region name if hosting differs,
> and flag it in the PR either way so it gets confirmed. "Every subprocessor listed"
> requires the subprocessors page to exist before this goes public.

### Closing CTA
64px padding, centred: "Start with this month's shoebox", supporting line, "Start free"
button → `/login`.

---

## Constraints

- **No new dependencies.** If you think one is needed, say so in the PR instead.
- **No icons.** The design is text-only by deliberate choice — adding an icon set is a
  design decision to run past the client, not a gap to fill.
- **No hardcoded hex values** — use task 00's tokens.
- **Hover:** outlined buttons shift border to `#18181b`; nav links `#52525b` → `#18181b`.
  Nothing else animates. Keep any transition ≤150ms, colour/opacity only.
- Headlines and long body get `text-wrap: pretty`.

## Verify before opening the PR

- [ ] `npm run build` and `npm run lint` clean
- [ ] Signed-out visit to `/` renders the full page; **signed-in visit redirects to
      `/receipts`** (test with a real session)
- [ ] Every link resolves to the route listed above. The `/legal/*` links will 404 until
      those pages are written — expected; say so in the PR rather than working around it
- [ ] Exactly one footer on the page
- [ ] Checked at **1080 / 768 / 420px**. At 420px the hero must stack **copy first,
      image second** — confirm the source order gives you that without a CSS reorder hack
- [ ] Keyboard pass: tab through the header and both CTA rows, focus always visible
- [ ] 44px minimum touch targets at mobile width
- [ ] Headline, reassurance line and the three "How it works" titles match verbatim

## Your PR description must contain

1. What you changed and why, ordered by importance — not a file list.
2. Every assumption you made where the spec was silent.
3. Every deviation from the spec, with reasoning. Deviations are fine; silent ones aren't.
4. Flags you were told to raise: the missing hero screenshot, the `/legal/*` 404s, and
   the "Stored in the US / Northern Virginia" hosting claim needing confirmation.
5. Any token or primitive you found missing from task 00 (do not patch them yourself).
6. What you did not test, honestly.

Keep commits small and logically separated. Open as a **draft PR against
`ui-improvements`**. Never force-push, never merge your own branch.

If you hit something genuinely ambiguous that changes the shape of the work, **stop and
ask** rather than guessing.
