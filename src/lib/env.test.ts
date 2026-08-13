import { describe, expect, it } from 'vitest'
import { requiredEnv } from './env'

/**
 * What this file is defending.
 *
 * A Supabase service-role JWT was pasted into Vercel line-wrapped, so the
 * newlines landed in the *middle* of the value. Nothing caught it: the variable
 * was present and non-empty, so every guard passed, and the failure surfaced
 * only at request time as `Headers.set: … is an invalid header value`, which
 * each route flattened into its own generic message. The cases below pin the
 * two halves of the fix — interior whitespace is removed, and absence is a
 * named error rather than an `undefined` handed to an SDK.
 */

describe('requiredEnv', () => {
  it('removes whitespace from the middle of a value, not just the ends', () => {
    // The actual shape of the outage: a wrapped JWT.
    const wrapped = 'eyJhbGciOiJIUzI1NiIs\nInR5cCI6IkpXVCJ9.\neyJzdWIiOiIxIn0'

    expect(requiredEnv('SUPABASE_SERVICE_ROLE_KEY', wrapped)).toBe(
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0',
    )
  })

  it.each([
    ['leading and trailing spaces', '  sk_live_abc  ', 'sk_live_abc'],
    ['a trailing newline', 'sk_live_abc\n', 'sk_live_abc'],
    ['carriage returns from a Windows paste', 'sk_live\r\n_abc', 'sk_live_abc'],
    ['interior tabs', 'sk_live\t_abc', 'sk_live_abc'],
  ])('strips %s', (_label, input, expected) => {
    expect(requiredEnv('STRIPE_SECRET_KEY', input)).toBe(expected)
  })

  it('leaves a clean value untouched', () => {
    const url = 'https://abcdefg.supabase.co'
    expect(requiredEnv('NEXT_PUBLIC_SUPABASE_URL', url)).toBe(url)
  })

  it.each([
    ['undefined', undefined],
    ['empty', ''],
    // Whitespace-only collapses to empty, so it has to fail like a missing
    // value rather than return '' and be handed to an SDK as a real key.
    ['only whitespace', '   \n  '],
  ])('throws when the variable is %s', (_label, input) => {
    expect(() => requiredEnv('STRIPE_WEBHOOK_SECRET', input)).toThrow(
      /Missing or empty environment variable: STRIPE_WEBHOOK_SECRET/,
    )
  })

  it('names the variable but never echoes the value', () => {
    const secret = 'sk_live_supersecret'

    // The error goes to logs, so the point of naming the variable is that the
    // fix is legible from the log line alone — without printing the key.
    expect(() => requiredEnv('STRIPE_SECRET_KEY', ` ${secret} `)).not.toThrow()
    try {
      requiredEnv('STRIPE_SECRET_KEY', undefined)
    } catch (e) {
      expect((e as Error).message).toContain('STRIPE_SECRET_KEY')
      expect((e as Error).message).not.toContain(secret)
    }
  })
})
