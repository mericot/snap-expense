# Task 03 — Receipt inbox (`/receipts`)

**Branch:** `design/03-inbox` off `ui-improvements` (after task 00 has merged)
**Owns:** `src/app/receipts/*`
**Reference:** `design_handoff_snapexpense_paid/README.md` §"3. Receipt inbox".
Prototype markup: `SnapExpense App.dc.html` lines 131–191.
**Depends on:** task 00 tokens, primitives, and the app move into `/receipts`.

**Largest task in the set.** It is the only one that restyles working, data-backed code
rather than building a new page, and it is the only one where the design asks for data
the schema does not have. Read the "schema gaps" section before starting.

## Purpose

The main working screen: see the month's receipts, fix what needs fixing, export.
Authenticated — redirect to `/login` without a session.

## What already exists

Task 00 moved the working app here unchanged: upload → `/api/extract` (Claude reads the
receipt) → review the extraction → save to Supabase → inline edit → delete → export CSV,
with a desktop table and a mobile card list. **All of that behaviour must survive this
branch.** You are restyling and reorganising, not rewriting the data layer.

The `expenses` table is `{ id, created_at, updated_at, user_id, merchant, date, total,
tax, category }` (`db/schema.sql`), with per-user RLS.

## Layout

**App header** — 16px/24px padding, bottom border. Left: wordmark + nav ("Receipts"
active `#18181b`, "Reports", "Settings" in `#71717a`, 14px, 16px gap). Right: "Upgrade"
outline button → `/pricing`, and a 30px circular avatar (`#e4e4e7` bg, initials 12px
`#52525b`) derived from the session email.

"Reports" and "Settings" have no routes and no designs. Render them as nav items and
decide in the PR whether they are disabled-looking or 404 — do not invent those pages.

Body, 24px padding, 20px gap between blocks:

**1. Month header row** — "March 2026" (22px/600/`-0.01em`) with a meta line beneath at
13px `#71717a`: "12 receipts · €1,284.60 · 3 need a category". Right: "Export CSV"
outline and "Add receipt" primary, both 13px. All three numbers are derived from real
data, not hardcoded. "Export CSV" wires to the existing `exportCSV()`; "Add receipt"
opens the existing file input.

**2. Dropzone** — `#fafafa`, 1px dashed `#d4d4d8`, 10px radius, 18px/20px padding:
"Drop a photo or PDF here — we read the merchant, date and total for you." This replaces
the current dashed button-with-camera-icon. Note the copy promises PDF; the current
`ALLOWED_TYPES` is images + HEIC only. Either add PDF support or change the copy —
**do not ship copy that promises a format the uploader rejects.** Changing the copy is
the smaller change and the right call for this branch; flag PDF as a follow-up.

**3. Receipt list** — container 1px `#e4e4e7`, 10px radius, overflow clipped. Each row:
14px/18px padding, 16px gap, bottom border `#f4f4f5`.
- Left: 36×44 thumbnail, 4px radius. No thumbnails exist — see schema gaps.
- Middle (flexes): merchant 14px/500 `#18181b`; meta line "18 Mar · Travel" 12px
  `#a1a1aa`.
- Status pill (see `Pill` from task 00): "Ready" in `#71717a`, "Needs category" in
  `#a16207`.
- Right: amount, 14px, **tabular numerals**, 84px wide, right-aligned.

Keep the existing inline edit and delete affordances working. The design does not show
them; preserve the current interaction (hover-revealed on desktop, buttons on the mobile
card) and restyle to the token palette. Say in the PR that edit/delete presentation is
undesigned and needs a pass.

**4. Quota row** — last row *inside* the list container, `#fafafa`: "You have used 10 of
10 free receipts this month." with an underlined "See plans" on the right → `/pricing`.
This is the paywall touchpoint. **Keep it calm and factual — no modal, no interrupt.**

**5. Retention notice** — bordered card, 16px/18px padding, 13px body. Bold lead "How
long we keep this." then, verbatim:

> Receipt images and the data we read from them stay until you delete them, then sit in
> encrypted backups for 30 days before they are gone for good. Deleting your account
> removes everything.

Plus a "Retention policy" link. **The 30-day figure must match the actual Supabase
backup lifecycle.** If it does not, the copy is wrong and has to change before launch —
raise it rather than shipping it.

## Schema gaps — the design asks for data we do not store

Proceed under these assumptions and state them in the PR:

| Design needs | We have | Assumption for this branch |
|---|---|---|
| Month grouping ("March 2026") | flat list ordered by `created_at` | group client-side by `date`; show the current month, no month switcher (undesigned) |
| Status `ready` / `needs_category` | `category` nullable | derive: `category == null` → "Needs category", else "Ready" |
| 36×44 thumbnail | image never stored — it is sent to `/api/extract` and discarded | render the placeholder box; **do not** build image upload here |
| Quota "10 of 10 free" | no plan or usage tracking | count this month's rows against a `FREE_MONTHLY_LIMIT = 10` constant; no enforcement |
| — | `/api/extract` already rate-limits to 20 uploads/hour/user and rejects >10 MB | surface those failures properly — see below |
| Currency `€` | `fmt()` outputs `$` | switch to EUR — see the open decision in the index |

Note that the **20 uploads/hour rate limit is a different thing from the 10/month free
quota** and is enforced server-side today. A user can hit it and the quota row will
still read "3 of 10". `/api/extract` returns actionable messages for rate-limit,
oversize, timeout and unsupported-media-type failures — surface them in the error state
rather than collapsing everything to "Something went wrong".

Storing receipt images is a real piece of work (Supabase Storage bucket, RLS, thumbnail
generation, and it makes the retention promise load-bearing). **It is out of scope for
this branch** — open a separate issue.

## States needed but not designed

Empty inbox, upload in progress, OCR failed, and a single receipt detail/edit view are
all called out in the handoff as missing. The first three exist in the current code in
some form — carry them across, restyled. Flag all four in the PR.

## Definition of done

- `npm run build` and `npm run lint` clean.
- **Full regression pass with a real session:** upload a receipt, confirm extraction,
  save, edit inline, delete, export CSV. Both desktop table and mobile card paths.
- Month header numbers, status pills and the quota count all derive from real rows —
  no hardcoded sample data left in.
- Retention copy verbatim.
- Status is conveyed by text, not colour alone.
- Checked at 1080, 768 and 420px; 44px touch targets on mobile.
