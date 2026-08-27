import { describe, it, expect } from 'vitest'
import type { Expense } from '@/lib/supabase'
import { groupByMonth, monthMeta, needsCategory, needsReview } from './format'

const receipt = (over: Partial<Expense> = {}): Expense => ({
  id: crypto.randomUUID(),
  created_at: '2026-08-20T10:00:00Z',
  merchant: 'THE HOME DEPOT',
  date: '2026-08-20',
  total: 10,
  tax: null,
  category: 'Hardware',
  confidence: 'high',
  deleted_at: null,
  ...over,
})

describe('needsReview', () => {
  it('flags an explicit low confidence', () => {
    expect(needsReview(receipt({ confidence: 'low' }))).toBe(true)
  })

  it('does not flag high confidence', () => {
    expect(needsReview(receipt({ confidence: 'high' }))).toBe(false)
  })

  it('does NOT flag rows saved before the column existed', () => {
    // This is the case that matters. Treating null as "needs review" would flag
    // every historical receipt the day this ships, and a list where everything
    // is flagged says nothing at all.
    expect(needsReview(receipt({ confidence: null }))).toBe(false)
  })

  it('ignores anything that is not exactly "low"', () => {
    for (const c of ['LOW', 'Low', 'medium', '', 'unknown']) {
      expect(needsReview(receipt({ confidence: c }))).toBe(false)
    }
  })

  it('is independent of needsCategory', () => {
    const r = receipt({ confidence: 'low', category: 'Hardware' })
    expect(needsReview(r)).toBe(true)
    expect(needsCategory(r)).toBe(false)
  })
})

describe('groupByMonth', () => {
  it('counts the low-confidence rows in each month', () => {
    const [group] = groupByMonth([
      receipt({ confidence: 'low' }),
      receipt({ confidence: 'low' }),
      receipt({ confidence: 'high' }),
      receipt({ confidence: null }),
    ])
    expect(group.count).toBe(4)
    expect(group.needingReview).toBe(2)
  })

  it('counts per month, not across the set', () => {
    const groups = groupByMonth([
      receipt({ date: '2026-08-20', confidence: 'low' }),
      receipt({ date: '2026-07-04', confidence: 'high' }),
    ])
    const aug = groups.find((g) => g.key === '2026-08')!
    const jul = groups.find((g) => g.key === '2026-07')!
    expect(aug.needingReview).toBe(1)
    expect(jul.needingReview).toBe(0)
  })
})

describe('monthMeta', () => {
  const base = { count: 12, total: 1284.6, needingCategory: 0, needingReview: 0 }

  it('omits both trailing segments on a tidy month', () => {
    expect(monthMeta(base)).toBe('12 receipts · $1,284.60')
  })

  it('adds the review count when there is one', () => {
    expect(monthMeta({ ...base, needingReview: 2 })).toContain('2 to check')
  })

  it('puts review ahead of category — money outranks filing', () => {
    const s = monthMeta({ ...base, needingReview: 2, needingCategory: 3 })
    expect(s.indexOf('2 to check')).toBeLessThan(s.indexOf('3 need a category'))
  })

  it('still singularises the category segment', () => {
    expect(monthMeta({ ...base, needingCategory: 1 })).toContain('1 needs a category')
  })
})
