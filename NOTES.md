# Engineering Notes — SnapExpense

A running journal of what broke, what the errors actually meant, and the
general rules worth keeping. Written as I built — first AI product, built
with Claude Code.

---

## Vision extraction

- Claude Haiku 4.5 reads receipt photos into strict JSON at ~$0.0025 per
  receipt. Output tokens cost ~5x input, but extraction output is tiny, so
  the image dominates cost.
- Resizing photos client-side (max ~1500px long edge) before base64-encoding
  cuts both cost and API body size. Phone photos are several MB raw.
- Rule set in the prompt that mattered most: **null over guessing** — an
  illegible total comes back null with `confidence: "low"` instead of a
  made-up number. Wrong money data is worse than missing money data.
- Models sometimes wrap JSON in ```fences``` despite instructions; strip
  fences before `JSON.parse` instead of fighting the prompt.

## Multi-tenancy (the three-layer model)

A request hits the database and the system asks three questions, in order:

1. **Who are you?** — Authentication (Supabase magic links). Produces
   `auth.uid()`.
2. **Whose is this?** — Ownership: `user_id uuid` column, foreign-keyed to
   `auth.users.id`, default `auth.uid()`.
3. **Are you allowed?** — Authorization: RLS policies on all four verbs,
   scoped to `user_id = auth.uid()`.

Lessons:
- **Auth alone is not privacy.** A signed-in stranger still sees everything
  if rows have no owner.
- **App-level filtering is a velvet rope.** The anon key ships to the
  browser by design; anyone can query the API directly. `WHERE user_id = me`
  in app code looks correct and protects nothing. RLS puts the rule inside
  Postgres where it can't be bypassed.
- **Build bottom-up, test per layer.** First attempt bundled auth + schema +
  email config in one change and got tangled (reverted). Second attempt did
  identity → ownership → enforcement with a checkpoint after each. Slices
  you can test one at a time.
- The Supabase dashboard bypasses RLS (owner's master key) — seeing all rows
  there is normal. User-level privacy is only proven by the two-account test
  in the app.

## Email / SMTP debugging

The magic-link 500 saga. Browser showed `AuthRetryableFetchError: {}` — 
useless. Supabase auth logs named every real cause:

- **535 "Authentication credentials invalid"** → SMTP password wrong. Fixed
  by rotating: create a fresh Resend API key and paste clean, instead of
  debugging the old one. Keys are disposable; time isn't.
- **550 "The icloud.com domain is not verified"** → looked like a recipient
  problem; then the same error appeared on mail sent *to Gmail*, which
  proved it was the **sender** field. The From address was set to a personal
  iCloud address — a domain I can't verify. Senders must be on a domain you
  own and have verified (SPF/DKIM records).
- Resend's shared `onboarding@resend.dev` sender only delivers to the Resend
  account's own email — fine for solo testing, useless for real users.
  Verifying my own domain lifted the restriction.

**General rule: read the logs before theorizing.** Every 500 had an exact,
different cause one log line away. Guessing produced three wrong hypotheses;
the log was right three times.

## DNS (learned the hard way)

- Layers: **registrar** (who you bought from) → **nameservers** (who
  publishes your DNS zone) → **records** (the entries) → routing. Each layer
  can be misconfigured independently.
- **Anyone can add any domain as a zone** in Cloudflare, and Vercel will
  accept any domain into a project — configuration ≠ ownership. Everything
  sits in "pending" forever if you don't control the registration. The
  purchase receipt is the ground truth.
- "It doesn't exist," "it isn't mine," and "it isn't configured" are three
  different states. snapexpense.app resolved to Cloudflare parking IPs —
  which means it exists and is registered *to someone else*. Bought
  snap-expenses.com instead. A domain that resolves is owned by somebody.
- Debugging tool: resolve the name and see who answers
  (`ping domain`, dnschecker.org). One lookup cut through what two
  dashboards couldn't explain.
- **CNAME collisions:** one name, one answer. The root (`@`) can't hold a
  CNAME alongside pre-created parking A/AAAA records — delete the squatters
  first.
- **Cloudflare orange cloud vs Vercel:** proxied DNS intercepts Vercel's
  certificate verification → SSL error 525. For Vercel-hosted apps the
  record must be **DNS only (grey cloud)**; Vercel does its own CDN + SSL.

## Process notes

- One phase per Claude Code session, with a human-verified checkpoint
  between phases. The one time I skipped this (first auth attempt), it
  tangled; the layered redo was smooth.
- Commit per green light. The git history reads as the build's story.
- The AI remembers syntax and config shapes; my job is the judgment layer —
  knowing what must exist (RLS, ownership), what to verify before trusting
  a change, and reading errors precisely.
