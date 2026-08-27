import { describe, it, expect } from 'vitest'
import type { Expense } from '@/lib/supabase'
import { findDuplicate, groupByMonth, monthMeta, needsCategory, needsReview } from './format'

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

describe('findDuplicate', () => {
  const saved = [
    receipt({ merchant: 'The Home Depot', date: '2026-08-27', total: 12102.57 }),
    receipt({ merchant: 'BLUE DORY COFFEE', date: '2026-05-03', total: 22 }),
  ]

  it('finds the same receipt scanned twice', () => {
    const hit = findDuplicate(saved, {
      merchant: 'The Home Depot', date: '2026-08-27', total: 12102.57,
    })
    expect(hit?.merchant).toBe('The Home Depot')
  })

  it('matches merchant case-insensitively', () => {
    // Both spellings occur in real rows; a case-sensitive match would miss the
    // duplicates this exists to catch.
    expect(findDuplicate(saved, {
      merchant: 'THE HOME DEPOT', date: '2026-08-27', total: 12102.57,
    })).not.toBeNull()
  })

  it('tolerates surrounding whitespace', () => {
    expect(findDuplicate(saved, {
      merchant: '  the home depot ', date: '2026-08-27', total: 12102.57,
    })).not.toBeNull()
  })

  it('compares totals numerically, since Postgres returns numeric as a string', () => {
    const asString = [receipt({ merchant: 'X', date: '2026-01-01', total: '227.50' as unknown as number })]
    expect(findDuplicate(asString, { merchant: 'X', date: '2026-01-01', total: 227.5 })).not.toBeNull()
  })

  it('does not match when any one field differs', () => {
    const base = { merchant: 'The Home Depot', date: '2026-08-27', total: 12102.57 }
    expect(findDuplicate(saved, { ...base, total: 12102.58 })).toBeNull()
    expect(findDuplicate(saved, { ...base, date: '2026-08-26' })).toBeNull()
    expect(findDuplicate(saved, { ...base, merchant: 'Lowes' })).toBeNull()
  })

  it('never matches on a null field', () => {
    // Two incomplete scans are not duplicates of each other.
    const withNulls = [receipt({ merchant: null as unknown as string, date: '2026-08-27', total: 1 })]
    expect(findDuplicate(withNulls, { merchant: null, date: '2026-08-27', total: 1 })).toBeNull()
    expect(findDuplicate(saved, { merchant: 'The Home Depot', date: null, total: 12102.57 })).toBeNull()
    expect(findDuplicate(saved, { merchant: 'The Home Depot', date: '2026-08-27', total: null })).toBeNull()
  })

  it('returns null on an empty list', () => {
    expect(findDuplicate([], { merchant: 'X', date: '2026-01-01', total: 1 })).toBeNull()
  })
})
