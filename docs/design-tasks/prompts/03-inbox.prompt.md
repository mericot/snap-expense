# Agent brief — Task 03: Receipt inbox (`/receipts`)

You are implementing **step 03 of a six-step sequence** that recreates a design handoff
in this codebase:

```
00 foundation  ✔ merged        01 landing  /            02 sign-in  /login
03 inbox       /receipts  ← you are here
04 pricing     /pricing        05 checkout /checkout
```

**Task 00 must already be merged into `ui-improvements`.** It built the tokens, the
primitives (`Button`, `Card`, `Pill`), the global footer, and — critically — **it already
moved the working expense app to `/receipts` unchanged and unrestyled.** Your job is to
restyle it. **A senior engineer reviews your PR.**

> **This is the largest and highest-risk task in the set.** It is the only one that
> restyles working, data-backed code rather than building a new page, and the only one
> where the design asks for data the schema does not have. Read "Schema gaps" before you
> write anything.

---

## Before you write any code

1. **Read `AGENTS.md`.** Next.js 16.2.12 has breaking changes — read
   `node_modules/next/dist/docs/` first.
2. **Read `docs/design-tasks/03-inbox.md`** and `docs/design-tasks/README.md`.
3. **Read what task 00 built** — `src/app/globals.css` for tokens, `src/components/ui/`
   for primitive APIs, and all of `src/app/receipts/` to understand the code you are
   about to restyle.
4. Design reference: `design_handoff_snapexpense_paid/README.md` §"3. Receipt inbox";
   prototype markup `SnapExpense App.dc.html` lines 131–191 (reference only).

### Market: USD / US — decided. The app already formats `$`. **Do not change the
currency.**

### Branching

**`main` is not to be touched.** `ui-improvements` is the integration branch.

Branch **`design/03-inbox`** off `ui-improvements`, in a git worktree.

**Precondition — verify before you branch:**

```bash
git cat-file -e ui-improvements:src/app/receipts/page.tsx && echo OK || echo MISSING
```

If `MISSING`, task 00 has not merged — **stop and say so.**

### Environment

- **`.env.local` is gitignored and will not exist in a fresh worktree.** Copy it from the
  main checkout. You cannot test this page without it. Never commit it.
- Dev server on a **non-default port** (`npx next dev -p 3013`).
- **Never use bare `git stash` / `git stash pop`** — shared stack across worktrees.
- **You share one Supabase project and one test account with every other agent.** Your
  testing is destructive (save, edit, delete). If another agent is mid-test you will see
  and delete each other's rows. `/api/extract` also rate-limits to **20 extractions/hour
  per user, enforced server-side** — burn it and later agents get spurious failures.
  Test deliberately, not in a loop.

---

## What you own

`src/app/receipts/*`. Nothing else. **Do not touch** `layout.tsx`, `globals.css`,
`src/components/ui/*`, `src/app/api/extract/route.ts`, `src/lib/supabase.ts`, or the
database schema. The API route's auth, rate limiting and body-size cap were added
deliberately.

Authenticated route — unauthenticated visits redirect to `/login` via task 00's session
gate.

---

## What must keep working

Task 00 moved this here untouched: upload → `/api/extract` (Claude reads the receipt) →
review the extraction → save to Supabase → inline edit → delete → export CSV, with a
desktop table and a mobile card list.

**All of it must survive.** You are restyling and reorganising, not rewriting the data
layer. The `expenses` table is `{ id, created_at, updated_at, user_id, merchant, date,
total, tax, category }` (`db/schema.sql`) with per-user RLS.

---

## The page

**App header** — 16px/24px padding, bottom border. Left: wordmark + nav ("Receipts"
active `#18181b`; "Reports", "Settings" in `#71717a`; 14px, 16px gap). Right: "Upgrade"
outline button → `/pricing`, and a 30px circular avatar (`#e4e4e7` bg, initials 12px
`#52525b`) derived from the session email.

"Reports" and "Settings" have no routes and no designs. Render them as nav items and
**decide deliberately** whether they read as disabled or 404 — say which in the PR. Do
not invent those pages.

Body, 24px padding, 20px gap between blocks:

**1. Month header row** — "March 2026" (22px/600/`-0.01em`), meta line beneath at 13px
`#71717a`: "12 receipts · $1,284.60 · 3 need a category". Right: "Export CSV" outline and
"Add receipt" primary, both 13px. **All three numbers derive from real data** — no
hardcoded sample values. "Export CSV" wires to the existing `exportCSV()`; "Add receipt"
opens the existing file input.

**2. Dropzone** — `#fafafa`, 1px dashed `#d4d4d8`, 10px radius, 18px/20px padding:
> Drop a photo or PDF here — we read the merchant, date and total for you.

> **The copy promises PDF; `ALLOWED_TYPES` is images + HEIC only.** Do not ship copy that
> promises a format the uploader rejects. Changing the copy is the smaller change and the
> right call for this branch — flag PDF support as a follow-up.

**3. Receipt list** — container 1px `#e4e4e7`, 10px radius, overflow clipped. Each row:
14px/18px padding, 16px gap, bottom border `#f4f4f5`.
- Left: 36×44 thumbnail, 4px radius — placeholder, see schema gaps.
- Middle (flexes): merchant 14px/500 `#18181b`; meta 12px `#a1a1aa`, US date convention
  month-first abbreviated — "Mar 18 · Travel".
- Status `Pill`: "Ready" in `#71717a`, "Needs category" in `#a16207`.
- Right: amount, 14px, **tabular numerals**, 84px wide, right-aligned, `$` with comma
  thousands separators and two decimals.

Keep inline edit and delete working. The design does not show them; preserve the current
interaction (hover-revealed on desktop, buttons on the mobile card), restyled. Say in the
PR that edit/delete presentation is undesigned and needs a pass.

**4. Quota row** — last row **inside** the list container, `#fafafa`: "You have used 10
of 10 free receipts this month." with an underlined "See plans" on the right →
`/pricing`. This is the paywall touchpoint. **Keep it calm and factual — no modal, no
interrupt.**

**5. Retention notice** — bordered card, 16px/18px padding, 13px body. Bold lead "How
long we keep this." then, verbatim:

> Receipt images and the data we read from them stay until you delete them, then sit in
> encrypted backups for 30 days before they are gone for good. Deleting your account
> removes everything.

Plus a "Retention policy" link. **The 30-day figure must match the actual Supabase backup
lifecycle.** If it does not, the copy is wrong — raise it rather than shipping it.

---

## Schema gaps — the design asks for data we do not store

Proceed under these assumptions and **state them in the PR**:

| Design needs | We have | Do this |
|---|---|---|
| Month grouping ("March 2026") | flat list by `created_at` | group client-side by `date`; current month only, no month switcher (undesigned) |
| Status `ready` / `needs_category` | `category` nullable | derive: `category == null` → "Needs category", else "Ready" |
| 36×44 thumbnail | image is sent to `/api/extract` and discarded, never stored | render the placeholder box — **do not build image upload here** |
| Quota "10 of 10 free" | no plan or usage tracking | count this month's rows against a `FREE_MONTHLY_LIMIT = 10` constant; no enforcement |

Storing receipt images is real work (Storage bucket, RLS, thumbnail generation, and it
makes the retention promise load-bearing). **Out of scope — open a separate issue.**

Note the **20 uploads/hour rate limit is a different thing from the 10/month quota** and
is enforced server-side today. A user can hit it while the quota row still reads "3 of
10". `/api/extract` returns actionable messages for rate-limit, oversize, timeout and
unsupported-media-type failures — **surface them** rather than collapsing everything to
"Something went wrong".

## States not designed

Empty inbox, upload in progress, OCR failed, and a single receipt detail/edit view. The
first three exist in the current code in some form — carry them across, restyled. Flag
all four in the PR.

## Constraints

- **No new dependencies.** No icons. No hardcoded hex values — use task 00's tokens.
- Status must be conveyed by **text, not colour alone**.
- Transitions ≤150ms, colour/opacity only.

## Verify before opening the PR

- [ ] `npm run build` and `npm run lint` clean
- [ ] **Full regression against a real session** — upload a receipt, confirm extraction,
      save, edit inline, delete, export CSV, on **both** the desktop table and the mobile
      card path. This is the main risk in your branch: prove you did not break working code
- [ ] Month header numbers, status pills and the quota count all derive from real rows —
      grep your diff for leftover sample data ("Amtrak", "1,284.60", "12 receipts")
- [ ] Retention copy verbatim; dropzone copy does not promise a format we reject
- [ ] An `/api/extract` failure renders its actual message, not a generic one
- [ ] Unauthenticated visit redirects to `/login`
- [ ] Keyboard pass over rows, edit/delete and the export button; focus always visible
- [ ] Checked at 1080 / 768 / 420px; 44px touch targets on mobile

## Your PR description must contain

1. What you changed and why, ordered by importance — not a file list.
2. **The regression you ran**, step by step, and its result.
3. Every schema-gap assumption from the table above, restated as shipped.
4. Every deviation from the spec, with reasoning.
5. Flags: the 30-day retention figure needing confirmation, PDF support, image/thumbnail
   storage, the four undesigned states, undesigned edit/delete presentation, and what you
   decided about "Reports"/"Settings".
6. What you did not test, honestly.

Keep commits small and logically separated. Open as a **draft PR against
`ui-improvements`**. Never force-push, never merge your own branch. If something
genuinely ambiguous comes up, **stop and ask** rather than guessing.
