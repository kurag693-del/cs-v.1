import { describe, expect, it } from 'vitest'

import { getRetryDelayMs, shouldMoveToDlq } from '@/lib/publish/queue/retry-policy'

describe('publish retry policy', () => {
  it('increases delay exponentially by attempt', () => {
    const first = getRetryDelayMs(1)
    const second = getRetryDelayMs(2)
    const third = getRetryDelayMs(3)

    expect(second).toBeGreaterThan(first)
    expect(third).toBeGreaterThan(second)
  })

  it('moves to DLQ after max attempts', () => {
    expect(shouldMoveToDlq(4)).toBe(false)
    expect(shouldMoveToDlq(5)).toBe(true)
    expect(shouldMoveToDlq(6)).toBe(true)
  })
})
