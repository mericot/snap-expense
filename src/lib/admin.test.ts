import { afterEach, describe, expect, it } from 'vitest'
import { isAdminEmail } from './admin'

/**
 * What this file is defending.
 *
 * `isAdminEmail` is the only thing standing between a signed-in customer and
 * the whole business's numbers. It has two ways to be wrong and they are not
 * equally bad: refusing the owner is an annoyance, admitting anyone else is a
 * data breach. So the cases below lean on the second — an unset variable, an
 * empty one, a list that happens to contain an empty entry — because those are
 * the states where a "helpful" default would quietly open the page up.
 */

const ORIGINAL = process.env.ANALYTICS_ADMIN_EMAILS

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.ANALYTICS_ADMIN_EMAILS
  else process.env.ANALYTICS_ADMIN_EMAILS = ORIGINAL
})

function configure(value: string | undefined) {
  if (value === undefined) delete process.env.ANALYTICS_ADMIN_EMAILS
  else process.env.ANALYTICS_ADMIN_EMAILS = value
}

describe('isAdminEmail — fails closed', () => {
  it('admits nobody when the variable is unset', () => {
    configure(undefined)
    expect(isAdminEmail('owner@example.com')).toBe(false)
  })

  it('admits nobody when the variable is empty', () => {
    configure('')
    expect(isAdminEmail('owner@example.com')).toBe(false)
  })

  // The one that would actually happen: a trailing comma, or a list edited down
  // to nothing but separators. Splitting that yields empty strings, and an
  // empty string must never match a caller with no email.
  it('does not let an empty list entry match an absent email', () => {
    configure('owner@example.com,,')
    expect(isAdminEmail(undefined)).toBe(false)
    expect(isAdminEmail(null)).toBe(false)
    expect(isAdminEmail('')).toBe(false)
  })

  it('rejects an email that is not on the list', () => {
    configure('owner@example.com')
    expect(isAdminEmail('someone-else@example.com')).toBe(false)
  })

  // Substring matching would be a catastrophic way to implement this.
  it('does not match on a substring or a lookalike domain', () => {
    configure('owner@example.com')
    expect(isAdminEmail('owner@example.com.attacker.test')).toBe(false)
    expect(isAdminEmail('notowner@example.com')).toBe(false)
    expect(isAdminEmail('owner@example.co')).toBe(false)
  })
})

describe('isAdminEmail — admits the owner', () => {
  it('matches a single configured address', () => {
    configure('owner@example.com')
    expect(isAdminEmail('owner@example.com')).toBe(true)
  })

  it('matches any address in a comma-separated list', () => {
    configure('a@example.com,b@example.com,c@example.com')
    expect(isAdminEmail('b@example.com')).toBe(true)
    expect(isAdminEmail('c@example.com')).toBe(true)
  })

  it('ignores case on both sides', () => {
    configure('Owner@Example.COM')
    expect(isAdminEmail('owner@example.com')).toBe(true)
    expect(isAdminEmail('OWNER@EXAMPLE.COM')).toBe(true)
  })

  it('tolerates spaces around list entries', () => {
    configure('a@example.com, b@example.com ,  c@example.com')
    expect(isAdminEmail('b@example.com')).toBe(true)
  })

  /**
   * The Vercel failure mode this project has already been bitten by: a value
   * pasted into the dashboard arrives line-wrapped, so the newline is *inside*
   * the variable rather than at either end. `trim()` would not save this one —
   * see src/lib/env.ts for the outage that taught us.
   */
  it('survives newlines inside the value', () => {
    configure('a@example.com,\nb@example.com,\n c@example.com\n')
    expect(isAdminEmail('b@example.com')).toBe(true)
    expect(isAdminEmail('c@example.com')).toBe(true)
  })
})
