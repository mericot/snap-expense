import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * What this file is defending.
 *
 * The promise made at the top of src/lib/analytics.ts is that tracking can
 * never fail a request. That promise is easy to state and easy to break — one
 * `await`, one unguarded throw, one rejected promise floating off into Node's
 * default `unhandledRejection` behaviour, which is to kill the process.
 *
 * So these tests do not check that events are recorded correctly so much as
 * they check that *nothing escapes*: a database that errors, a database that
 * throws, a missing service-role key, and the case where `after()` itself is
 * unavailable because there is no request in progress. In every one of them
 * `track` must return quietly.
 */

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  createAdmin: vi.fn(),
  after: vi.fn(),
}))

vi.mock('next/server', () => ({
  after: mocks.after,
}))

vi.mock('@/lib/supabase-admin', () => ({
  createSupabaseAdmin: mocks.createAdmin,
}))

const { track, latencyBucket, sizeBucket } = await import('./analytics')

/** Runs the callback `after()` was handed, the way the server eventually would. */
async function flushAfter() {
  for (const [callback] of mocks.after.mock.calls) {
    await callback()
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.insert.mockResolvedValue({ error: null })
  mocks.createAdmin.mockReturnValue({ from: () => ({ insert: mocks.insert }) })
  // Default: a working request scope that captures the callback rather than
  // running it, which is what the real `after` does.
  mocks.after.mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('track — scheduling', () => {
  it('defers the write instead of performing it inline', () => {
    track('receipt_uploaded', { userId: 'user_1' })

    // The response must not be waiting on a row insert.
    expect(mocks.after).toHaveBeenCalledOnce()
    expect(mocks.insert).not.toHaveBeenCalled()
  })

  it('writes the event once the deferred work runs', async () => {
    track('receipt_uploaded', { userId: 'user_1', props: { plan: 'free' } })
    await flushAfter()

    expect(mocks.insert).toHaveBeenCalledWith({
      name: 'receipt_uploaded',
      user_id: 'user_1',
      props: { plan: 'free' },
    })
  })

  it('records a null actor when no user id is given', async () => {
    track('account_deleted', { props: { had_subscription: true } })
    await flushAfter()

    expect(mocks.insert).toHaveBeenCalledWith({
      name: 'account_deleted',
      user_id: null,
      props: { had_subscription: true },
    })
  })

  it('defaults props to an empty object rather than null', async () => {
    // The column is `not null default '{}'`, so sending null would be rejected
    // by Postgres for every event that carries no props — which is most of the
    // lifecycle ones.
    track('signed_in', { userId: 'user_1' })
    await flushAfter()

    expect(mocks.insert).toHaveBeenCalledWith({
      name: 'signed_in',
      user_id: 'user_1',
      props: {},
    })
  })
})

describe('track — nothing escapes', () => {
  it('swallows a database error', async () => {
    mocks.insert.mockResolvedValue({ error: { message: 'permission denied' } })

    track('receipt_uploaded', { userId: 'user_1' })
    await expect(flushAfter()).resolves.toBeUndefined()
  })

  it('swallows a rejected insert', async () => {
    mocks.insert.mockRejectedValue(new Error('connection reset'))

    track('receipt_uploaded', { userId: 'user_1' })
    await expect(flushAfter()).resolves.toBeUndefined()
  })

  /**
   * `createSupabaseAdmin` throws when SUPABASE_SERVICE_ROLE_KEY is missing or
   * whitespace-damaged. A real misconfiguration — but not one that analytics
   * gets to turn into a failed extraction.
   */
  it('swallows a missing service-role key', async () => {
    mocks.createAdmin.mockImplementation(() => {
      throw new Error('Missing or empty environment variable: SUPABASE_SERVICE_ROLE_KEY')
    })

    track('receipt_uploaded', { userId: 'user_1' })
    await expect(flushAfter()).resolves.toBeUndefined()
  })

  /**
   * `after()` throws outside a request scope. The fallback path runs the write
   * as a floating promise — which must still not be able to produce an
   * unhandled rejection, because Node treats those as fatal by default.
   */
  it('falls back to an immediate write when after() is unavailable', async () => {
    mocks.after.mockImplementation(() => {
      throw new Error('`after` was called outside a request scope')
    })

    expect(() => track('receipt_uploaded', { userId: 'user_1' })).not.toThrow()

    // The fallback still performs the write; it just does not schedule it.
    await vi.waitFor(() => expect(mocks.insert).toHaveBeenCalledOnce())
  })

  it('does not reject when the fallback write also fails', async () => {
    mocks.after.mockImplementation(() => {
      throw new Error('`after` was called outside a request scope')
    })
    mocks.insert.mockRejectedValue(new Error('connection reset'))

    const rejections: unknown[] = []
    const onRejection = (reason: unknown) => rejections.push(reason)
    process.on('unhandledRejection', onRejection)

    expect(() => track('receipt_uploaded', { userId: 'user_1' })).not.toThrow()
    // Let the microtask queue drain so a floating rejection would surface.
    await new Promise((resolve) => setTimeout(resolve, 10))

    process.off('unhandledRejection', onRejection)
    expect(rejections).toEqual([])
  })
})

/**
 * The buckets exist so an exact millisecond count and an exact byte count —
 * both close to per-request fingerprints when paired with a timestamp — never
 * reach the table. Boundaries are asserted because an off-by-one here silently
 * changes what every historical chart means.
 */
describe('latencyBucket', () => {
  it('buckets by magnitude', () => {
    expect(latencyBucket(0)).toBe('<1s')
    expect(latencyBucket(999)).toBe('<1s')
    expect(latencyBucket(1_000)).toBe('1-2s')
    expect(latencyBucket(1_999)).toBe('1-2s')
    expect(latencyBucket(2_000)).toBe('2-5s')
    expect(latencyBucket(4_999)).toBe('2-5s')
    expect(latencyBucket(5_000)).toBe('5-10s')
    expect(latencyBucket(10_000)).toBe('10-30s')
    expect(latencyBucket(30_000)).toBe('>30s')
    expect(latencyBucket(120_000)).toBe('>30s')
  })
})

describe('sizeBucket', () => {
  it('buckets by megabyte', () => {
    const MB = 1024 * 1024
    expect(sizeBucket(0)).toBe('<0.5MB')
    expect(sizeBucket(MB * 0.49)).toBe('<0.5MB')
    expect(sizeBucket(MB * 0.5)).toBe('0.5-1MB')
    expect(sizeBucket(MB)).toBe('1-2MB')
    expect(sizeBucket(MB * 2)).toBe('2-5MB')
    expect(sizeBucket(MB * 5)).toBe('>5MB')
    // The route rejects anything above 10 MB before this is reached, but the
    // bucket must still name it rather than return undefined.
    expect(sizeBucket(MB * 50)).toBe('>5MB')
  })
})
