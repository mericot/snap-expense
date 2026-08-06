# Agent brief — Task 02: Sign in (`/login`)

You are implementing **step 02 of a six-step sequence** that recreates a design handoff
in this codebase:

```
00 foundation  ✔ merged        01 landing  /
02 sign-in     /login  ← you are here
03 inbox       /receipts       04 pricing  /pricing     05 checkout /checkout
```

**Task 00 must already be merged into `ui-improvements` before you start.** It built the
tokens, the primitives (`Button`, `Card`, `Input`, `Label`), the global footer, and a
stub `src/app/login/page.tsx` reserved for you. **A senior engineer reviews your PR.**

This is the smallest task in the set, but it carries a consent requirement that is not
negotiable. Read "Verbatim consent copy" before writing anything.

---

## Before you write any code

1. **Read `AGENTS.md`.** Next.js 16.2.12 has breaking changes versus what you may
   remember — read `node_modules/next/dist/docs/` before writing routes or components.
2. **Read `docs/design-tasks/02-signin.md`** and `docs/design-tasks/README.md`.
3. **Read what task 00 built** — `src/app/globals.css` for token names,
   `src/components/ui/` for the primitives' real APIs. Do not build a second Input.
4. Design reference: `design_handoff_snapexpense_paid/README.md` §"2. Sign in";
   prototype markup `SnapExpense App.dc.html` lines 117–130 (reference only). The three
   footer explorations in `SnapExpense Sign-in - footer options.dc.html` are context
   only — option 1b was chosen and task 00 already built it globally.

### Market: USD / US — decided, do not revisit.

### Branching

**`main` is not to be touched.** `ui-improvements` is the integration branch.

Branch **`design/02-signin`** off `ui-improvements`, in a git worktree.

**Precondition — verify before you branch:**

```bash
git cat-file -e ui-improvements:src/components/ui/Input.tsx && echo OK || echo MISSING
```

If `MISSING`, task 00 has not merged — **stop and say so.** Do not roll your own.

### Environment

- **`.env.local` is gitignored and will not exist in a fresh worktree.** Copy it from
  the main checkout — without it Supabase auth cannot work and you cannot test the one
  thing this page does. Never commit it or hardcode the keys.
- Dev server on a **non-default port** (`npx next dev -p 3012`).
- **Never use bare `git stash` / `git stash pop`** — shared stack across worktrees.

---

## What you own

`src/app/login/page.tsx`. Nothing else. **Do not touch** `layout.tsx`, `globals.css`,
`src/components/ui/*`, or any other route.

---

## The page

You are **restyling working auth, not changing it.** The logic already exists — it was
the `LoginScreen` component in the pre-task-00 `src/app/page.tsx` (find it in git history
if task 00 moved it). It calls:

```ts
supabase.auth.signInWithOtp({
  email,
  options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
})
```

**Keep that behaviour exactly.** Do not switch auth methods, do not add a password field,
do not change the redirect.

**Layout** — `#f7f7f7` panel, 72px top padding, centred column.

- Wordmark 30px / 700 / `-0.02em`.
- Subtitle "Sign in to manage your receipts", 15px `#71717a`, 8px below.
- Card 28px below the subtitle: max 400px, white, 1px `#e4e4e7`, 10px radius, 24px
  padding. Contents:
  - "Email" label, 14px `#27272a`, **bound to the input via `id`**.
  - A real `<input type="email" autocomplete="email" required>` — 8px radius, 11px/13px
    padding, 14px text, visible focus ring. The prototype renders inputs as static
    `div`s; that is a prototype shortcut, not a design.
  - Primary "Send magic link" button, full width, 13px padding, 8px radius, 15px text,
    8px top margin.
  - Then the consent microcopy.

### Verbatim consent copy

Centred **inside the card, directly under the button**, 12px `#71717a`, line-height 1.5:

> We email you a one-time link. No password stored. See [Terms] and [Privacy Policy].

Both links underlined, to `/legal/terms` and `/legal/privacy`.

> **This line lives inside the card, under the button — not in the footer, not behind a
> link, not in a tooltip.** It must be visible at the moment of submission. Do not move
> it, do not collapse it, do not reword it. This wording was reviewed with the client.

---

## States

- **Idle** — the form above.
- **Loading** — button disabled, label "Sending…".
- **Sent** — the existing "check your inbox" state. Restyle it to the new tokens and
  **keep the copy**, including "If you don't see it, check your spam or junk folder."
  (added deliberately in commit `c2ca362`) and the "Use a different email" escape hatch.
  The handoff notes this state was never designed — flag in the PR that it needs a
  design pass.
- **Error** — the current code surfaces `error.message`. Keep that, styled to the
  palette. It also logs the raw Supabase error to the console behind an `any` cast;
  tidy that while you are here.

## Behaviour

- **Rate-limit link requests in the UI.** Supabase enforces a server-side limit, but the
  button should not be hammerable — disable it and show a cooldown after a send.
- The link itself must be single-use and short-lived, with the expiry stated in the
  email. That is Supabase email-template configuration, **not app code and out of scope
  for this branch** — but note it in the PR so it is not lost.

## Constraints

- **No new dependencies.** No icons. No hardcoded hex values — use task 00's tokens.
- Keep any transition ≤150ms, colour/opacity only. Nothing moves.

## Verify before opening the PR

- [ ] `npm run build` and `npm run lint` clean
- [ ] **A real magic-link round trip works**: submit → email arrives → clicking it lands
      on `/receipts`. This is the whole point of the page; do not skip it
- [ ] Signed-in visit to `/login` redirects to `/receipts`
- [ ] Consent line present inside the card, under the button, both links working
- [ ] Input has a bound label, `type="email"`, `autocomplete="email"`, visible focus ring
- [ ] Button meets a 44px touch target at 420px
- [ ] Keyboard-only pass: tab to input and button, submit with Enter, focus always visible
- [ ] Error state renders readably (force one with an invalid address)
- [ ] Checked at 768 and 420px

## Your PR description must contain

1. What you changed and why, ordered by importance.
2. Confirmation that the auth call is unchanged, and the round trip you actually ran.
3. Every assumption where the spec was silent; every deviation, with reasoning.
4. Flags: the undesigned "check your inbox" state, the Supabase email-template work
   (single-use + expiry copy) that remains outstanding, and the `/legal/*` 404s.
5. What you did not test, honestly.

Keep commits small. Open as a **draft PR against `ui-improvements`**. Never force-push,
never merge your own branch. If something genuinely ambiguous comes up, **stop and ask**.
