# Supabase auth configuration

Everything here lives in the Supabase dashboard, not in this repository, under
**Authentication → URL Configuration**
(`https://supabase.com/dashboard/project/xwliqiknhalqoldpchgu/auth/url-configuration`).

It is written down because it is invisible from the code and because getting it
wrong produces the exact bug this document exists to prevent: a user clicks
their magic link and lands on `https://snap-expenses.com/?code=<uuid>`, still
signed out, with no error anywhere.

One Supabase project backs local development, Vercel previews and production, so
every host that can request a magic link has to be listed here.

---

## Site URL

```
https://snap-expenses.com
```

The site **root**, not a callback path.

Site URL does two jobs, and only one of them is redirects. It is also exposed to
the email templates as `{{ .SiteURL }}`, so pointing it at `/auth/callback`
would leak a callback path into every "visit our site" link in every email we
ever send. The root is the correct value for the thing it is actually naming.

Its redirect job is to be the **fallback** when a sign-in does not specify
`emailRedirectTo`, or specifies one that is not on the allow-list below. With
the allow-list correct that fallback should never fire. If a user ever reports
landing on the marketing page with `?code=` in the URL, this is the setting that
sent them there, and the allow-list is what is actually wrong.

## Redirect URLs

The complete allow-list is six entries. This is the full intended state — it can
be diffed against the dashboard directly, and anything in the dashboard that is
not in this list should be treated as unexplained.

```
https://snap-expenses.com/auth/callback
https://snap-expense-*-mericot.vercel.app/auth/callback
http://localhost:3000/auth/callback
http://localhost:3010/auth/callback
http://10.0.0.151:3000/auth/callback
http://10.0.0.151:3010/auth/callback
```

| Entry | Why |
| --- | --- |
| `https://snap-expenses.com/auth/callback` | Production. Exact path, no wildcard — see the note below. |
| `https://snap-expense-*-mericot.vercel.app/auth/callback` | Vercel preview deployments. |
| `http://localhost:3000/auth/callback` | `npm run dev` default port. |
| `http://localhost:3010/auth/callback` | Second dev port, for running two branches at once. |
| `http://10.0.0.151:3000/auth/callback` | LAN address, for testing on a real phone. `npm run dev` binds `0.0.0.0`, and `next.config.ts` allows this IP via `allowedDevOrigins`. If DHCP reassigns it, both the config and these two entries have to change. |
| `http://10.0.0.151:3010/auth/callback` | Same, second port. |

`http`, not `https`, for the local and LAN entries — the dev server does not
serve TLS, and the scheme is matched literally.

### How the wildcard in the Vercel entry works

From Supabase's [redirect URL
docs](https://supabase.com/docs/guides/auth/redirect-urls): the separator
characters are `.` and `/`. `*` matches any run of **non-separator** characters,
so it cannot cross a dot or a slash. `**` matches anything at all, including
separators.

That distinction is the whole reason this entry is safe:

```
https://snap-expense-*-mericot.vercel.app/auth/callback
```

- The `*` is pinned between the literal prefix `snap-expense-` and the literal
  suffix `-mericot.vercel.app`, so it only ever matches this project's
  deployments inside this Vercel team.
- Because `*` cannot cross a `.`, nobody can widen it with a subdomain —
  `https://snap-expense-anything.evil.vercel.app/auth/callback` does not match.
- Because `-` is *not* a separator, one entry covers both preview URL shapes
  Vercel produces: commit previews
  (`snap-expense-lcns7gpuz-mericot.vercel.app`) and branch previews
  (`snap-expense-git-design-01-landing-mericot.vercel.app`).

**Do not replace this with `https://*.vercel.app/auth/callback`.** That would
allow *any* deployment on `vercel.app`, by anyone, to be handed a live auth code
for this project. It is a one-character-looking change with a real account
takeover behind it.

**Do not "tidy" production into a wildcard either.** Supabase's own guidance is
that wildcards are for local development and preview URLs, and that production
should be an exact path. `https://snap-expenses.com/auth/callback` is already
exact; leave it that way.

---

## What the application does with this

`src/app/login/page.tsx` requests
`emailRedirectTo: ${window.location.origin}/auth/callback`. Supabase honours
that value **only** if it matches an entry above; otherwise it silently
substitutes the Site URL, with no error to the caller and no warning in the
dashboard. That silence is what made the original bug hard to see.

`src/app/auth/callback/route.ts` then exchanges the code for a session
server-side and sets the session cookie on its redirect response. Failures land
on `/auth/error` with a readable message.

`src/proxy.ts` keeps a narrow safety net: a request to `/` carrying `?code=` or
`?error_code=` is forwarded to `/auth/callback`. It exists only to catch the
Site URL fallback described above, and it is a partial catch at best — see the
next section. Once this allow-list is confirmed in the dashboard, that block is
dead code and can be deleted.

## Why the host matters so much: PKCE

`@supabase/ssr` hardcodes `flowType: "pkce"`. When the browser requests a magic
link it generates a code verifier and stores it in a cookie
(`sb-xwliqiknhalqoldpchgu-auth-token-code-verifier`). The callback needs that
cookie to redeem the code.

Cookies are scoped to a host. So a link **requested** on one host and
**opened** on another can never complete, no matter what is configured here —
the verifier simply is not present. Concretely:

- Request a link on `localhost:3000`, open it on `snap-expenses.com` → dead.
  (This is what the Site URL fallback used to cause.)
- Request a link on a laptop, open it on a phone → dead. Different browser,
  different cookie jar. The callback detects the missing verifier and says so
  rather than showing a generic failure.

Getting these entries right removes the first case. The second is inherent to
PKCE and would need a different link format (`token_hash` + `verifyOtp`) to
fix; that is deliberately not implemented yet.

## Email templates

Under **Authentication → Email Templates**, the magic link template currently
uses `{{ .ConfirmationURL }}`, which is the form that produces
`?code=<uuid>` and requires PKCE. If the cross-device limitation above ever
becomes worth fixing, that template is the thing that changes — to a
`{{ .TokenHash }}` link — and `/auth/callback` grows a `verifyOtp` branch to
match. Both halves have to change together; changing the template alone breaks
sign-in entirely.
