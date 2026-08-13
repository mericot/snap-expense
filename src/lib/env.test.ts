import { beforeEach, describe, expect, it, vi } from 'vitest'
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

// Repairs warn, so without this the suite prints a wall of yellow for cases
// that are deliberately feeding it damaged values.
beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

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

/**
 * The warning exists because the repair is otherwise invisible: the process
 * gets a working key, the dashboard keeps the broken one, and the same patch
 * happens again on the next boot forever.
 *
 * Each case imports a fresh copy of the module. The set that suppresses repeat
 * warnings is module state, so a static import would leak the first case's
 * warning into the rest.
 */
describe('requiredEnv repair warning', () => {
  /**
   * `vi.spyOn` on an already-spied method hands back the same mock, so its
   * recorded calls survive from the previous case — hence the explicit clear
   * alongside the module reset.
   */
  async function freshEnv() {
    vi.resetModules()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    warn.mockClear()
    return { requiredEnv: (await import('./env')).requiredEnv, warn }
  }

  it('warns when it repairs a value', async () => {
    const { requiredEnv: fresh, warn } = await freshEnv()

    fresh('SUPABASE_SERVICE_ROLE_KEY', 'eyJhbGci\nOiJIUzI1')

    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain('SUPABASE_SERVICE_ROLE_KEY')
  })

  it('stays silent for a value that needed no repair', async () => {
    const { requiredEnv: fresh, warn } = await freshEnv()

    fresh('NEXT_PUBLIC_SUPABASE_URL', 'https://abcdefg.supabase.co')

    expect(warn).not.toHaveBeenCalled()
  })

  it('warns once per variable, not once per call', async () => {
    const { requiredEnv: fresh, warn } = await freshEnv()

    // The per-request paths — proxy.ts, supabase-server.ts — read the same
    // variable on every page view. One line, not one per request.
    for (let i = 0; i < 25; i++) {
      fresh('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'eyJhbGci\nOiJIUzI1')
    }

    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('warns separately for each damaged variable', async () => {
    const { requiredEnv: fresh, warn } = await freshEnv()

    fresh('STRIPE_SECRET_KEY', 'sk_live\n_a')
    fresh('STRIPE_WEBHOOK_SECRET', 'whsec\n_b')

    expect(warn).toHaveBeenCalledTimes(2)
  })

  it('reports how much whitespace it removed without printing the secret', async () => {
    const { requiredEnv: fresh, warn } = await freshEnv()
    const secret = 'sk_live_supersecret'

    fresh('STRIPE_SECRET_KEY', `  ${secret}\n`)

    const message = warn.mock.calls[0][0] as string
    expect(message).toContain('3 whitespace')
    // The whole point of logging a count rather than the value.
    expect(message).not.toContain(secret)
  })
})
