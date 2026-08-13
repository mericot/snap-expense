import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'
import type Stripe from 'stripe'

/**
 * What this file is defending.
 *
 * The route used to sell a subscription to anyone who asked, including someone
 * who already had one. `/checkout` looked like it covered that — it redirects
 * an active subscriber to `/receipts` — but it reads the local `subscriptions`
 * row, which is only ever as fresh as the last webhook that landed, and the
 * route behind it can be POSTed to directly regardless. The outcome was a
 * second subscription on the same Stripe customer and two charges a month for
 * one plan.
 *
 * So the cases below are written from the customer's side of it: given what
 * Stripe says this person already has, do we take their money again? The one
 * assertion that matters in every refusal is that
 * `checkout.sessions.create` was never reached.
 */

// `vi.mock` factories are hoisted above the imports, so the spies they close
// over have to be created by `vi.hoisted` or they are still in the temporal
// dead zone when the factory runs.
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  single: vi.fn(),
  subscriptionsList: vi.fn(),
  customersCreate: vi.fn(),
  sessionsCreate: vi.fn(),
  adminUpdateEq: vi.fn(),
}))

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: () => ({
      select: () => ({
        eq: () => ({ single: mocks.single }),
      }),
    }),
  }),
}))

vi.mock('@/lib/supabase-admin', () => ({
  createSupabaseAdmin: () => ({
    from: () => ({
      update: () => ({ eq: mocks.adminUpdateEq }),
    }),
  }),
}))

vi.mock('@/lib/stripe', () => ({
  stripe: {
    subscriptions: { list: mocks.subscriptionsList },
    customers: { create: mocks.customersCreate },
    checkout: { sessions: { create: mocks.sessionsCreate } },
  },
}))

// Imported after the mocks are registered, which is the whole reason this is
// not a top-of-file import.
const { POST } = await import('./route')

const USER_ID = 'user_abc'
const CUSTOMER_ID = 'cus_existing'
const MONTHLY = 'price_pro_monthly'
const YEARLY = 'price_pro_yearly'

/** The route only ever calls `.json()` on the request, so this is enough of one. */
function request(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest
}

/**
 * Only `id` and `status` are read by the guard. Faking the other ~40 fields of
 * a real Stripe subscription would add nothing a reader of this test wants.
 */
function subscription(id: string, status: Stripe.Subscription.Status) {
  return { id, status } as Stripe.Subscription
}

/** What Stripe reports this customer already has. */
function stripeReturns(...subscriptions: Stripe.Subscription[]) {
  mocks.subscriptionsList.mockResolvedValue({ data: subscriptions })
}

beforeEach(() => {
  vi.clearAllMocks()

  process.env.STRIPE_PRO_MONTHLY_PRICE_ID = MONTHLY
  process.env.STRIPE_PRO_YEARLY_PRICE_ID = YEARLY
  // Left unset on purpose: Team is withheld from sale, and the allow-list is
  // built from the environment precisely so that an unset id means unbuyable.
  delete process.env.STRIPE_TEAM_MONTHLY_PRICE_ID

  mocks.getUser.mockResolvedValue({ data: { user: { id: USER_ID, email: 'a@b.com' } }, error: null })
  mocks.single.mockResolvedValue({ data: { stripe_customer_id: CUSTOMER_ID } })
  mocks.customersCreate.mockResolvedValue({ id: 'cus_brand_new' })
  mocks.sessionsCreate.mockResolvedValue({ client_secret: 'cs_secret' })
  mocks.adminUpdateEq.mockResolvedValue({ error: null })
  stripeReturns()
})

describe('POST /api/stripe/checkout — duplicate subscription guard', () => {
  it('refuses to sell to a customer who already has an active subscription', async () => {
    stripeReturns(subscription('sub_live', 'active'))

    const res = await POST(request({ priceId: MONTHLY }))
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.redirectTo).toBe('/settings')
    expect(body.error).toMatch(/already have a subscription/i)
    expect(mocks.sessionsCreate).not.toHaveBeenCalled()
  })

  /**
   * The bug this whole change exists for. A customer who slipped through once
   * already has two live subscriptions; the guard has to refuse a third rather
   * than treat the duplicate state as normal.
   */
  it('refuses when the customer is already double-subscribed', async () => {
    stripeReturns(
      subscription('sub_first', 'active'),
      subscription('sub_accidental_second', 'active'),
    )

    const res = await POST(request({ priceId: MONTHLY }))

    expect(res.status).toBe(409)
    expect(mocks.sessionsCreate).not.toHaveBeenCalled()
  })

  it('asks Stripe about the right customer', async () => {
    stripeReturns(subscription('sub_live', 'active'))

    await POST(request({ priceId: MONTHLY }))

    expect(mocks.subscriptionsList).toHaveBeenCalledWith(
      expect.objectContaining({ customer: CUSTOMER_ID }),
    )
  })

  // past_due and unpaid are the cases /checkout's own guard never looked at —
  // it only checks active and trialing — and they are the worst ones to get
  // wrong, because that card is already failing.
  const blocking: Stripe.Subscription.Status[] = [
    'active',
    'trialing',
    'past_due',
    'unpaid',
    'paused',
  ]

  it.each(blocking)('refuses when an existing subscription is %s', async (status) => {
    stripeReturns(subscription('sub_x', status))

    const res = await POST(request({ priceId: MONTHLY }))

    expect(res.status).toBe(409)
    expect(mocks.sessionsCreate).not.toHaveBeenCalled()
  })

  // These people are entitled to buy. `incomplete` especially: it is a first
  // payment that never landed, Stripe expires it on its own after 23 hours, and
  // blocking on it would strand someone whose card was declined once behind an
  // error insisting they already subscribed.
  const notBlocking: Stripe.Subscription.Status[] = [
    'canceled',
    'incomplete',
    'incomplete_expired',
  ]

  it.each(notBlocking)('still sells when the only subscription is %s', async (status) => {
    stripeReturns(subscription('sub_old', status))

    const res = await POST(request({ priceId: MONTHLY }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.clientSecret).toBe('cs_secret')
    expect(mocks.sessionsCreate).toHaveBeenCalledOnce()
  })

  it('sells to a returning customer whose past subscription is canceled', async () => {
    stripeReturns(
      subscription('sub_old', 'canceled'),
      subscription('sub_older', 'canceled'),
    )

    const res = await POST(request({ priceId: YEARLY }))

    expect(res.status).toBe(200)
    expect(mocks.sessionsCreate).toHaveBeenCalledOnce()
  })

  it('does not ask Stripe at all when the buyer has no customer record yet', async () => {
    mocks.single.mockResolvedValue({ data: { stripe_customer_id: null } })

    const res = await POST(request({ priceId: MONTHLY }))

    // A customer created moments ago cannot have subscriptions, so the lookup
    // would be a guaranteed miss and a wasted round trip on every first
    // purchase — the most latency-sensitive request in the funnel.
    expect(mocks.subscriptionsList).not.toHaveBeenCalled()
    expect(mocks.customersCreate).toHaveBeenCalledOnce()
    expect(res.status).toBe(200)
  })

  it('refuses before creating anything, so a blocked attempt leaves no trace', async () => {
    stripeReturns(subscription('sub_live', 'active'))

    await POST(request({ priceId: MONTHLY }))

    expect(mocks.customersCreate).not.toHaveBeenCalled()
    expect(mocks.sessionsCreate).not.toHaveBeenCalled()
  })
})

describe('POST /api/stripe/checkout — guard does not weaken the existing checks', () => {
  it('rejects an unauthenticated caller before looking anything up', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'no session' } })

    const res = await POST(request({ priceId: MONTHLY }))

    expect(res.status).toBe(401)
    expect(mocks.subscriptionsList).not.toHaveBeenCalled()
  })

  it('rejects a price that is not on the allow-list', async () => {
    const res = await POST(request({ priceId: 'price_invented_by_the_caller' }))

    expect(res.status).toBe(400)
    expect(mocks.sessionsCreate).not.toHaveBeenCalled()
  })

  it('keeps withheld Team unbuyable while its price id is unset', async () => {
    const res = await POST(request({ priceId: 'price_team_monthly' }))

    expect(res.status).toBe(400)
    expect(mocks.sessionsCreate).not.toHaveBeenCalled()
  })
})
