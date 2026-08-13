# Task 02 — Sign in (`/login`)

**Branch:** `design/02-signin` off `ui-improvements` (after task 00 has merged)
**Owns:** `src/app/login/page.tsx`
**Reference:** `design_handoff_snapexpense_paid/README.md` §"2. Sign in".
Prototype markup: `SnapExpense App.dc.html` lines 117–130. Footer explorations in
`SnapExpense Sign-in - footer options.dc.html` are context only — option 1b was chosen
and is already the global footer from task 00.
**Depends on:** task 00 tokens, `Button`, `Card`, `Input`, `Label`.

Smallest task in the set, but it carries a consent requirement — read the "verbatim"
section below before writing anything.

## Purpose

Passwordless email sign-in. The working logic already exists: it is the `LoginScreen`
component that lived in the pre-task-00 `src/app/page.tsx` (see git history if task 00
removed it). It calls `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo:
window.location.origin + '/auth/callback' } })`. **Keep that behaviour.** This task
restyles it and adds the consent line; it does not change auth.

## Layout

`#f7f7f7` panel, 72px top padding, centred column.

- Wordmark 30px / 700 / `-0.02em`.
- Subtitle "Sign in to manage your receipts", 15px `#71717a`, 8px below.
- Card 28px below the subtitle: max 400px, white, 1px `#e4e4e7`, 10px radius, 24px
  padding. Contents:
  - "Email" label, 14px `#27272a`, bound to the input via `id`.
  - Real `<input type="email" autocomplete="email" required>` — 8px radius, 11px/13px
    padding, 14px text, visible focus ring.
  - Primary "Send magic link" button, full width, 13px padding, 8px radius, 15px text,
    8px top margin.
  - Then the consent microcopy.

## Verbatim consent copy

Centred inside the card, directly under the button, 12px `#71717a`, line-height 1.5:

> We email you a one-time link. No password stored. See [Terms] and [Privacy Policy].

Both links underlined, to `/legal/terms` and `/legal/privacy`.

**This line lives inside the card, under the button — not in the footer.** It has to be
visible at the moment of submission. Do not move it, do not collapse it behind a link,
do not reword it.

## States

- **Idle** — the form above.
- **Loading** — button disabled, label "Sending…".
- **Sent** — the existing "check your inbox" state. The handoff notes this state was
  never designed; the current implementation is reasonable and already carries a useful
  spam-folder hint (commit `c2ca362`). Restyle it to match the new tokens and keep the
  copy, including "If you don't see it, check your spam or junk folder." and the "Use a
  different email" escape hatch. Flag in the PR that this state needs a design pass.
- **Error** — the current code surfaces `error.message`. Keep it, styled to the token
  palette. It currently also logs the raw Supabase error to the console with an `any`
  cast; tidy that while you are here.

## Behaviour requirements from the handoff

- **Rate-limit link requests.** Supabase enforces a server-side limit, but the UI should
  not let a user hammer the button — disable it and show a cooldown after a send.
- The link itself must be single-use and short-lived, and the email should state the
  expiry. That is Supabase email-template configuration, not app code — **out of scope
  for this branch**, but note it in the PR so it is not lost.

## Definition of done

- `npm run build` and `npm run lint` clean.
- A real magic link round-trip works: submit → email arrives → clicking it lands on
  `/receipts` (task 00 fixed the callback redirect).
- Signed-in visit to `/login` redirects to `/receipts`.
- Consent line present inside the card with both links working.
- Input has a bound label, `type="email"`, `autocomplete="email"`, and a visible focus
  ring. Button meets 44px touch target at 420px.
- Checked at 768 and 420px.
