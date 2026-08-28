import { describe, it, expect } from 'vitest'
import { isPaidPlan, isPaymentFailing } from './subscription'

describe('isPaidPlan', () => {
  it('grants access on the ordinary paid states', () => {
    expect(isPaidPlan('pro', 'active')).toBe(true)
    expect(isPaidPlan('pro', 'trialing')).toBe(true)
    expect(isPaidPlan('team', 'active')).toBe(true)
  })

  it('keeps access while a payment is being retried', () => {
    // The point of the change. Stripe retries a failed invoice for about two
    // weeks before firing subscription.deleted; cutting access at the first
    // failure took the product away from someone who intended to pay.
    expect(isPaidPlan('pro', 'past_due')).toBe(true)
  })

  it('stays consistent with the checkout route', () => {
    // /api/stripe/checkout has always treated past_due as a live subscription
    // and refuses to sell a second one. When this disagreed, someone with an
    // expired card was too subscribed to buy and not subscribed enough to use.
    expect(isPaidPlan('pro', 'past_due')).toBe(true)
  })

  it('ends access once Stripe has given up', () => {
    expect(isPaidPlan('pro', 'canceled')).toBe(false)
  })

  it('does not extend grace to a first payment that never landed', () => {
    // `incomplete` is a signup that never completed — there is no established
    // relationship to be generous towards.
    expect(isPaidPlan('pro', 'incomplete')).toBe(false)
  })

  it('never treats the free plan as paid, whatever the status', () => {
    for (const s of ['active', 'trialing', 'past_due', 'canceled', 'incomplete']) {
      expect(isPaidPlan('free', s)).toBe(false)
    }
  })

  it('fails closed on missing data', () => {
    expect(isPaidPlan(null, 'active')).toBe(false)
    expect(isPaidPlan('pro', null)).toBe(false)
    expect(isPaidPlan(undefined, undefined)).toBe(false)
    expect(isPaidPlan('pro', 'something-new-from-stripe')).toBe(false)
  })
})

describe('isPaymentFailing', () => {
  it('is true only while a paid plan is past due', () => {
    expect(isPaymentFailing('pro', 'past_due')).toBe(true)
    expect(isPaymentFailing('team', 'past_due')).toBe(true)
  })

  it('is false in every healthy state', () => {
    expect(isPaymentFailing('pro', 'active')).toBe(false)
    expect(isPaymentFailing('pro', 'trialing')).toBe(false)
  })

  it('is false once the subscription has actually ended', () => {
    // Nothing to fix by then — the banner would offer a portal visit that
    // changes nothing.
    expect(isPaymentFailing('pro', 'canceled')).toBe(false)
  })

  it('never fires for a free account', () => {
    expect(isPaymentFailing('free', 'past_due')).toBe(false)
    expect(isPaymentFailing(null, 'past_due')).toBe(false)
  })
})

describe('the two together', () => {
  it('past_due is the one state that is both paid and worth warning about', () => {
    const states = ['active', 'trialing', 'past_due', 'canceled', 'incomplete']
    const both = states.filter((s) => isPaidPlan('pro', s) && isPaymentFailing('pro', s))
    expect(both).toEqual(['past_due'])
  })

  it('access and the warning never contradict each other', () => {
    // Warning someone their payment failed while denying them access is the
    // combination that made the old behaviour hostile.
    for (const s of ['active', 'trialing', 'past_due', 'canceled', 'incomplete']) {
      if (isPaymentFailing('pro', s)) expect(isPaidPlan('pro', s)).toBe(true)
    }
  })
})
