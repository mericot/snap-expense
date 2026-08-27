import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requiredEnv } from '@/lib/env'

let _client: SupabaseClient | null = null

function getClient() {
  if (!_client) {
    _client = createBrowserClient(
      requiredEnv('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
      requiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    )
  }
  return _client
}

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient(), prop, receiver)
  },
})

export type Expense = {
  id: string
  created_at: string
  merchant: string
  date: string
  total: number
  tax: number | null
  category: string | null
  /** 'high' | 'low', or null for rows saved before the column existed. */
  confidence: string | null
  deleted_at: string | null
}

export type Subscription = {
  id: string
  created_at: string
  updated_at: string
  user_id: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  stripe_price_id: string | null
  plan: 'free' | 'pro' | 'team'
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete'
  trial_ends_at: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  seats: number
}
