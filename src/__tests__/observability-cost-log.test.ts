import { describe, expect, it } from 'vitest'

import { formatAiCostLog, normalizeObservabilityError } from '@/lib/observability/cost-log'
import { evaluateQueueHealth } from '@/lib/observability/queue-monitor'

describe('observability cost log', () => {
  it('formats ai cost payload and redacts sensitive fields', () => {
    const payload = formatAiCostLog({
      userId: 'user_1',
      generationId: 'gen_1',
      provider: 'gigachat',
      model: 'giga-pro',
      totalTokens: 1234,
      costUsd: 0.03124567,
      metadata: {
        token: 'secret_value',
        scenario: 'social_post',
      },
    })

    expect(payload.event).toBe('ai_cost')
    expect(payload.userId).toBe('user_1')
    expect(payload.usage.totalTokens).toBe(1234)
    expect(payload.usage.costUsd).toBe(0.031246)
    expect(payload.metadata?.token).toBe('[redacted]')
    expect(payload.metadata?.scenario).toBe('social_post')
    expect(typeof payload.correlationId).toBe('string')
  })

  it('normalizes unknown runtime errors to safe shape', () => {
    const fromError = normalizeObservabilityError(new Error('Boom'))
    const fromString = normalizeObservabilityError('oops')
    const fromUnknown = normalizeObservabilityError({ random: true })

    expect(fromError).toEqual({ code: 'INTERNAL_ERROR', message: 'Boom' })
    expect(fromString).toEqual({ code: 'INTERNAL_ERROR', message: 'oops' })
    expect(fromUnknown).toEqual({ code: 'INTERNAL_ERROR', message: 'Unexpected error' })
  })
})

describe('queue monitor health', () => {
  it('returns warning and critical states by thresholds', () => {
    const warning = evaluateQueueHealth({
      pendingJobs: 5,
      failedJobs: 1,
      dlqSize: 4,
      oldestPendingAgeSec: 100,
    })
    const critical = evaluateQueueHealth({
      pendingJobs: 12,
      failedJobs: 7,
      dlqSize: 12,
      oldestPendingAgeSec: 1500,
    })

    expect(warning.status).toBe('warning')
    expect(warning.alerts.length).toBeGreaterThan(0)
    expect(critical.status).toBe('critical')
    expect(critical.alerts.length).toBeGreaterThan(1)
  })
})
