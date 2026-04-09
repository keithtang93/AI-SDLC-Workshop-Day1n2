import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  calculateNextDueDate,
  toSingaporeISOString,
  formatSingaporeDate,
  isSingaporePast,
  isFutureEnough,
} from '../../lib/timezone'

describe('calculateNextDueDate', () => {
  it('should add 1 day for daily pattern', () => {
    const result = calculateNextDueDate('2026-04-09T10:00:00.000Z', 'daily')
    const date = new Date(result)
    assert.equal(date.getUTCDate(), 10)
    assert.equal(date.getUTCMonth(), 3) // April = 3
  })

  it('should add 7 days for weekly pattern', () => {
    const result = calculateNextDueDate('2026-04-09T10:00:00.000Z', 'weekly')
    const date = new Date(result)
    assert.equal(date.getUTCDate(), 16)
    assert.equal(date.getUTCMonth(), 3)
  })

  it('should add 1 month for monthly pattern', () => {
    const result = calculateNextDueDate('2026-04-09T10:00:00.000Z', 'monthly')
    const date = new Date(result)
    assert.equal(date.getUTCMonth(), 4) // May = 4
    assert.equal(date.getUTCDate(), 9)
  })

  it('should handle month-end edge case (Jan 31 → Feb 28)', () => {
    const result = calculateNextDueDate('2026-01-31T10:00:00.000Z', 'monthly')
    const date = new Date(result)
    assert.equal(date.getUTCMonth(), 1) // February
    assert.equal(date.getUTCDate(), 28)
  })

  it('should add 1 year for yearly pattern', () => {
    const result = calculateNextDueDate('2026-04-09T10:00:00.000Z', 'yearly')
    const date = new Date(result)
    assert.equal(date.getUTCFullYear(), 2027)
    assert.equal(date.getUTCMonth(), 3)
    assert.equal(date.getUTCDate(), 9)
  })

  it('should handle leap year edge case (Feb 29 → Feb 28)', () => {
    const result = calculateNextDueDate('2024-02-29T10:00:00.000Z', 'yearly')
    const date = new Date(result)
    assert.equal(date.getUTCFullYear(), 2025)
    assert.equal(date.getUTCMonth(), 1) // February
    assert.equal(date.getUTCDate(), 28)
  })

  it('should handle daily rollover to next month', () => {
    const result = calculateNextDueDate('2026-04-30T10:00:00.000Z', 'daily')
    const date = new Date(result)
    assert.equal(date.getUTCMonth(), 4) // May
    assert.equal(date.getUTCDate(), 1)
  })

  it('should handle weekly rollover to next month', () => {
    const result = calculateNextDueDate('2026-04-28T10:00:00.000Z', 'weekly')
    const date = new Date(result)
    assert.equal(date.getUTCMonth(), 4) // May
    assert.equal(date.getUTCDate(), 5)
  })

  it('should handle December monthly rollover to January', () => {
    const result = calculateNextDueDate('2026-12-15T10:00:00.000Z', 'monthly')
    const date = new Date(result)
    assert.equal(date.getUTCFullYear(), 2027)
    assert.equal(date.getUTCMonth(), 0) // January
    assert.equal(date.getUTCDate(), 15)
  })
})

describe('toSingaporeISOString', () => {
  it('should return ISO string with +08:00 offset', () => {
    const date = new Date('2026-04-09T02:00:00.000Z')
    const result = toSingaporeISOString(date)
    assert.ok(result.endsWith('+08:00'))
  })

  it('should format year-month-day correctly', () => {
    const date = new Date('2026-01-15T00:00:00.000Z')
    const result = toSingaporeISOString(date)
    assert.ok(result.startsWith('2026-01-15'))
  })
})

describe('formatSingaporeDate', () => {
  it('should format date string into human-readable format', () => {
    const result = formatSingaporeDate('2026-04-09T10:30:00.000Z')
    assert.ok(typeof result === 'string')
    assert.ok(result.length > 0)
    // Should contain parts of the date
    assert.ok(result.includes('2026') || result.includes('Apr'))
  })
})

describe('isSingaporePast', () => {
  it('should return true for a date far in the past', () => {
    assert.equal(isSingaporePast('2000-01-01T00:00:00.000Z'), true)
  })

  it('should return false for a date far in the future', () => {
    assert.equal(isSingaporePast('2099-12-31T23:59:59.000Z'), false)
  })

  it('should return true for yesterday', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString()
    assert.equal(isSingaporePast(yesterday), true)
  })

  it('should return false for tomorrow', () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString()
    assert.equal(isSingaporePast(tomorrow), false)
  })
})

describe('isFutureEnough', () => {
  it('should return true for a date more than 1 minute in the future', () => {
    const future = new Date(Date.now() + 120000).toISOString() // 2 minutes
    assert.equal(isFutureEnough(future), true)
  })

  it('should return false for a date in the past', () => {
    const past = new Date(Date.now() - 60000).toISOString()
    assert.equal(isFutureEnough(past), false)
  })

  it('should return false for a date less than 1 minute in the future', () => {
    const tooSoon = new Date(Date.now() + 30000).toISOString() // 30 seconds
    assert.equal(isFutureEnough(tooSoon), false)
  })

  it('should return true for a date 1 hour in the future', () => {
    const oneHour = new Date(Date.now() + 3600000).toISOString()
    assert.equal(isFutureEnough(oneHour), true)
  })

  it('should return true for a date far in the future', () => {
    assert.equal(isFutureEnough('2099-12-31T23:59:59.000Z'), true)
  })
})
