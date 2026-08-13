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
 */
export function requiredEnv(name: string, value: string | undefined): string {
  const cleaned = value?.replace(/\s+/g, '')
  if (!cleaned) {
    throw new Error(
      `Missing or empty environment variable: ${name}. ` +
        `Set it for this environment and redeploy.`,
    )
  }
  return cleaned
}
