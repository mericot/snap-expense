import Stripe from 'stripe'
import { requiredEnv } from '@/lib/env'

let _stripe: Stripe | null = null

function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(requiredEnv('STRIPE_SECRET_KEY', process.env.STRIPE_SECRET_KEY))
  }
  return _stripe
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    return Reflect.get(getStripe(), prop, receiver)
  },
})
