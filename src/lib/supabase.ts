import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Expense = {
  id: string
  created_at: string
  date: string
  merchant: string
  amount: number
  currency: string
  category: string | null
  description: string | null
  image_url: string | null
}
