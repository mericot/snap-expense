/**
 * src/proxy.ts sends signed-out visitors to `/login?next=<where they wanted to
 * go>`, so a sign-in can round-trip that value and land the user where they
 * started.
 *
 * This lived inside src/app/auth/callback/route.ts until a second caller
 * appeared (src/app/api/test-login/route.ts). It moved here rather than being
 * written twice: an open-redirect check is exactly the kind of thing that
 * should have one reviewed implementation, not a copy that drifts.
 *
 * Only same-origin *paths* pass: a leading `/`, but not `//host` or `/\host`
 * (both of which browsers read as protocol-relative), and no backslashes or
 * control characters that URL parsers disagree about.
 */
export function safeNext(value: string | null): string | null {
  if (!value) return null
  if (!value.startsWith('/')) return null
  if (value.startsWith('//') || value.startsWith('/\\')) return null
  for (const ch of value) {
    const code = ch.codePointAt(0)!
    if (ch === '\\' || code < 0x20 || code === 0x7f) return null
  }
  return value
}
