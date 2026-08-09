# Test login (magic-link bypass)

One configured email address can sign in without an emailed link, by presenting
a shared secret. Everything else about that session is ordinary: it is minted
through the same Supabase endpoint a magic link uses, so RLS, the proxy gate,
plan limits and `/api/extract` all see a normal signed-in user. The only thing
skipped is the email.

It exists for two reasons:

- **Development speed.** Every sign-in otherwise costs an inbox round trip.
- **Automation.** PKCE ties a magic link to the browser that requested it (see
  [auth-setup.md](./auth-setup.md#why-the-host-matters-so-much-pkce)), so a
  headless test cannot complete one. This endpoint uses the `token_hash` flow
  instead, which has no such constraint.

---

## Setup

Three environment variables. All three, or the bypass does not exist.

```bash
# The one address that can use it. Any address; it does not need to be real,
# and no mail is ever sent to it. It is created in Supabase on first use.
TEST_LOGIN_EMAIL=test@snap-expenses.com

# Server-side only. openssl rand -base64 24
TEST_LOGIN_SECRET=<32+ characters>

# Same address again, this time readable by the login page so it knows when to
# show the secret field. Public by design — see "Why the address is public".
NEXT_PUBLIC_TEST_LOGIN_EMAIL=test@snap-expenses.com
```

`SUPABASE_SERVICE_ROLE_KEY` must also be set (it already is — Stripe's webhook
handler uses it). The bypass mints the link with the admin API.

If `TEST_LOGIN_EMAIL` names an address that does not exist in Supabase yet, the
first sign-in creates it, with a free-plan subscription row, exactly as a real
signup would.

That requires `db/migrations/2026-08-09-pin-security-definer-search-path.sql`,
which has been applied to the live project (2026-08-09). Without it, creating
*any* new user fails with `Database error saving new user` — a pre-existing bug
that building this endpoint surfaced. A freshly provisioned project gets the fix
from `db/subscriptions.sql` directly.

**Do not set these in Vercel's production environment.** The route refuses to
run when `VERCEL_ENV=production` regardless, but the variables not being there
is the control that matters; the env check is the backstop for pasting them
into the wrong place.

## Using it

**From the login page.** Type the configured address. The form swaps from "Send
magic link" to a secret field and "Sign in to test account". You land on
`/receipts`, or on `?next=` if the proxy sent you to `/login` from somewhere
else.

**From a script or a test.** POST JSON and keep the cookies:

```bash
curl -sS -X POST http://localhost:3000/api/test-login \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$TEST_LOGIN_EMAIL\",\"secret\":\"$TEST_LOGIN_SECRET\"}" \
  -c cookies.txt
# {"redirectTo":"/receipts"}

curl -sS http://localhost:3000/receipts -b cookies.txt   # signed in
```

In Playwright, `request.post()` on the browser context's request object puts
the session cookies straight into that context, so a `beforeEach` can sign in
once and every test starts authenticated.

Responses:

| Status | Meaning |
| --- | --- |
| 200 | Signed in. Body is `{"redirectTo":"/receipts"}`; the session is in `Set-Cookie`. |
| 400 | Body was not JSON. |
| 401 | Wrong address or wrong secret — deliberately not distinguished. |
| 404 | The bypass is not configured here, or this is production. |
| 429 | 10 failed attempts within 5 minutes. Best-effort; see below. |
| 500 | Supabase rejected the admin call. Check the service role key matches the project in `NEXT_PUBLIC_SUPABASE_URL`. |

## How it works

`src/app/api/test-login/route.ts`, in two steps:

1. `admin.generateLink({ type: 'magiclink', email })` asks Supabase for the link
   it *would have* emailed and hands it back instead of sending it. This also
   creates the user on first use, which is why there is no separate step for
   provisioning the test account. The useful field is
   `properties.hashed_token`.
2. `verifyOtp({ token_hash, type })` on a request-scoped client redeems that
   token for a session, and the cookie writes are attached to the response —
   the same ordering `/auth/callback` relies on so that the proxy sees a
   session on the very next request.

The `type` passed to step 2 is `properties.verification_type` from step 1, not
the `magiclink` that step 1 asked for, and the difference is load bearing.
Asking for a `magiclink` returns a `magiclink` token only when the user already
exists; for an address Supabase has never seen, the same call creates the user
and issues a **`signup`** token instead. GoTrue looks tokens up by (hash, type),
so verifying a signup token as a magiclink matches nothing and fails with

```
403 otp_expired  "Email link is invalid or has expired"
```

on a token generated microseconds earlier. If the first sign-in to a fresh
address ever starts failing that way again, this is the line to look at.

## What makes it safe

The gate is `src/lib/test-login.ts`, and it is the only place that decides
whether the bypass exists. Three independent conditions, any one of which
failing yields a 404:

1. `TEST_LOGIN_EMAIL` is set. Exactly one address, compared case-insensitively.
   Not a domain, not a pattern.
2. `TEST_LOGIN_SECRET` is set and at least 32 characters. Shorter fails closed
   and logs why, rather than quietly accepting a weak secret.
3. `VERCEL_ENV` is not `production`.

Then, in the route:

- **404, not 403, when unconfigured.** A production probe cannot tell this route
  from one that was never deployed.
- **One error for both wrong-address and wrong-secret**, and both checks always
  run rather than early-returning on the address. Early-returning would make a
  wrong address measurably faster than a wrong secret and turn the endpoint into
  an oracle for which address is configured.
- **Constant-time secret comparison** (`timingSafeEqual` over SHA-256 digests,
  so lengths are not compared or leaked).
- **Secret in the request body, never the query string.** URLs reach server
  logs, browser history and `Referer` headers; bodies do not.
- **Failure throttling** — 10 failures per 5 minutes, reset on success. Labelled
  best-effort in the code and here: it is module state, so a serverless
  deployment has one counter per instance and a restart clears it. Against a
  32-character secret it is not what is keeping anyone out; it is there so that
  a merely-adequate secret is not also unlimited-guess.

### Why the address is public

`NEXT_PUBLIC_TEST_LOGIN_EMAIL` ships in the browser bundle. It is half of a
credential and the half that opens nothing on its own — the secret is never sent
to the client and is typed by the tester. Making the address public is what lets
the bypass be discoverable *by typing it*, with no hidden query parameter or key
combination to remember.

`TEST_LOGIN_SECRET` must never be given a `NEXT_PUBLIC_` prefix. That single
change would publish the bypass.

## Rotating or removing it

Rotating: change `TEST_LOGIN_SECRET`. Nothing is stored anywhere, so there is
nothing to clean up. Removing: unset the three variables — the route 404s and
the login page stops offering the field. The test user itself remains in
Supabase and can be deleted from the dashboard.
