/**
 * Reads a required environment variable, removing any whitespace inside it.
 *
 * Not just trimmed. The outage this exists to prevent was a Supabase
 * service-role JWT pasted into Vercel line-wrapped, so the newlines were in the
 * *middle* of the value — `trim()` would not have touched them. Node then threw
 * `Headers.set: "eyJhbGciOi…" is an invalid header value` on every request that
 * used the key, which the route handlers flattened into a generic 500. Nothing
 * pointed at the environment.
 *
 * None of the values read through here — project URLs, JWTs, Stripe keys — can
 * legitimately contain whitespace, so stripping it is a repair, not a guess.
 *
 * Takes the value rather than the name because Next.js only inlines
 * `process.env.NEXT_PUBLIC_*` into the client bundle when it appears as a
 * literal member expression; a `process.env[name]` lookup is left alone and
 * would read `undefined` in the browser.
 *
 * A repair is also reported once per variable — see `warned`.
 */

/**
 * Variables already reported, so the warning does not repeat.
 *
 * `proxy.ts` and `supabase-server.ts` call this on every request, so an
 * unconditional warn would put a line in the log for every page view and bury
 * the thing it is trying to point at.
 */
const warned = new Set<string>()

export function requiredEnv(name: string, value: string | undefined): string {
  const cleaned = value?.replace(/\s+/g, '')
  if (!cleaned) {
    throw new Error(
      `Missing or empty environment variable: ${name}. ` +
        `Set it for this environment and redeploy.`,
    )
  }

  // Silently repairing means the malformed value in the dashboard is never
  // fixed — it just gets patched again on every boot, and the next person to
  // read it back out of Vercel finds the same broken string. The count is safe
  // to print and enough to tell a wrapped paste from a stray trailing newline;
  // the value itself is a secret and never goes to the log.
  if (cleaned !== value && !warned.has(name)) {
    warned.add(name)
    console.warn(
      `${name} contained ${value!.length - cleaned.length} whitespace ` +
        `character(s) and was repaired in memory. The stored value is still ` +
        `malformed — reset it for this environment and redeploy.`,
    )
  }

  return cleaned
}
