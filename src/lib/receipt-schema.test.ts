import { describe, it, expect } from 'vitest'
import { validateReceipt, RECEIPT_TOOL } from './receipt-schema'
import { CATEGORIES } from './categories'

const base = {
  merchant: 'THE HOME DEPOT',
  date: '2026-08-20',
  subtotal: 9445.29,
  tax: 590.33,
  tip: null,
  total: 10035.62,
  category: 'Hardware',
  confidence: 'high',
}

describe('validateReceipt', () => {
  it('passes a receipt that agrees with itself', () => {
    const r = validateReceipt(base)
    expect(r.reasons).toEqual([])
    expect(r.downgraded).toBe(false)
    expect(r.receipt.confidence).toBe('high')
    expect(r.receipt.total).toBe(10035.62)
  })

  it('catches the corruption that motivated all of this', () => {
    // The observed failure: leading '$' read as a digit on both lines. Positive,
    // numeric, tax below total, valid date — every naive check passes.
    const r = validateReceipt({ ...base, total: 110035.02, tax: 8590.33 })
    expect(r.reasons).toContain('totals_do_not_add_up')
    expect(r.downgraded).toBe(true)
    expect(r.receipt.confidence).toBe('low')
  })

  it('catches it even when only the tax is wrong', () => {
    // The run where total was right and tax was not: per-field scoring called
    // this a pass, the arithmetic does not.
    const r = validateReceipt({ ...base, tax: 550.23 })
    expect(r.reasons).toContain('totals_do_not_add_up')
  })

  it('does not flag a restaurant receipt with a tip', () => {
    // 82.50 + 5.16 is not 104.66 until the tip is counted. Leaving tip out of
    // the sum would flag every restaurant receipt there is.
    const r = validateReceipt({
      ...base, merchant: 'THE GRANARY TABLE', date: '2026-04-12',
      subtotal: 82.5, tax: 5.16, tip: 17.0, total: 104.66, category: 'Meals',
    })
    expect(r.reasons).toEqual([])
    expect(r.receipt.confidence).toBe('high')
  })

  it('does not flag a card slip with no tax line', () => {
    const r = validateReceipt({
      ...base, merchant: 'BLUE DORY COFFEE', date: '2026-05-03',
      subtotal: 18.4, tax: null, tip: 3.6, total: 22.0, category: 'Meals',
    })
    expect(r.reasons).toEqual([])
  })

  it('does not flag a refund, whose numbers are all negative', () => {
    const r = validateReceipt({
      ...base, date: '2026-06-19', subtotal: -45.8, tax: -2.87, tip: null, total: -48.67,
    })
    expect(r.reasons).toEqual([])
    expect(r.receipt.total).toBe(-48.67)
  })

  it('compares tax to total by magnitude, not sign', () => {
    // On a refund, -2.87 > -48.67 is true. Comparing raw values would flag
    // every refund as tax exceeding total.
    const refund = validateReceipt({ ...base, subtotal: -45.8, tax: -2.87, total: -48.67 })
    expect(refund.reasons).not.toContain('tax_exceeds_total')

    const wrong = validateReceipt({ ...base, subtotal: 10, tax: 90, tip: null, total: 20 })
    expect(wrong.reasons).toContain('tax_exceeds_total')
  })

  it('allows a cent or two of rounding', () => {
    expect(validateReceipt({ ...base, total: 10035.63 }).reasons).toEqual([])
    expect(validateReceipt({ ...base, total: 10035.70 }).reasons).toContain('totals_do_not_add_up')
  })

  it('cannot check arithmetic without a subtotal, and says nothing rather than guessing', () => {
    const r = validateReceipt({ ...base, subtotal: null })
    expect(r.reasons).toEqual([])
  })

  it('rejects a non-numeric total instead of passing it to the database', () => {
    const r = validateReceipt({ ...base, total: 'twelve dollars' })
    expect(r.receipt.total).toBeNull()
    expect(r.reasons).toContain('total_not_numeric')
  })

  it('rejects a malformed date', () => {
    const r = validateReceipt({ ...base, date: 'March 3rd' })
    expect(r.receipt.date).toBeNull()
    expect(r.reasons).toContain('date_unparseable')
  })

  it('flags dates in the future and the distant past', () => {
    const future = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)
    expect(validateReceipt({ ...base, date: future }).reasons).toContain('date_in_future')
    expect(validateReceipt({ ...base, date: '2001-01-01' }).reasons).toContain('date_too_old')
  })

  it('flags a total the column cannot hold', () => {
    const r = validateReceipt({ ...base, subtotal: null, total: 1e9 })
    expect(r.reasons).toContain('total_out_of_range')
  })

  it('coerces an invented category and reports it', () => {
    const r = validateReceipt({ ...base, category: 'Groceries' })
    expect(r.receipt.category).toBe('Other')
    expect(r.coercedCategory).toBe(true)
  })

  it('treats any confidence that is not "high" as low', () => {
    for (const c of ['low', 'medium', '', null, undefined, 7]) {
      expect(validateReceipt({ ...base, confidence: c }).receipt.confidence).toBe('low')
    }
  })

  it('does not report a downgrade when the model already said low', () => {
    const r = validateReceipt({ ...base, total: 110035.02, confidence: 'low' })
    expect(r.receipt.confidence).toBe('low')
    expect(r.downgraded).toBe(false)
    expect(r.reasons).toContain('totals_do_not_add_up')
  })

  it('survives junk without throwing', () => {
    for (const junk of [null, undefined, {}, { total: {} }, { merchant: 42 }, []]) {
      expect(() => validateReceipt(junk)).not.toThrow()
    }
    expect(validateReceipt({}).receipt.confidence).toBe('low')
  })
})

describe('RECEIPT_TOOL', () => {
  it('enumerates exactly the categories the app knows', () => {
    expect(RECEIPT_TOOL.input_schema.properties.category.enum).toEqual([...CATEGORIES])
  })

  it('requires every field, so a silent omission cannot look like a null', () => {
    expect(RECEIPT_TOOL.input_schema.required).toEqual(
      expect.arrayContaining(['merchant', 'date', 'subtotal', 'tax', 'tip', 'total', 'category', 'confidence']),
    )
  })
})
