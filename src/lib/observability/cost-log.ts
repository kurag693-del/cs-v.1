type ErrorShape = {
  code: string
  message: string
}

type CostLogMetadata = Record<string, unknown>

export type AiCostLogInput = {
  userId: string
  generationId?: string
  provider: string
  model: string
  totalTokens: number
  costUsd: number
  correlationId?: string
  metadata?: CostLogMetadata
}

const SENSITIVE_KEY_PARTS = ['token', 'secret', 'password', 'authorization', 'cookie']

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase()
  return SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part))
}

function sanitizeMetadata(metadata?: CostLogMetadata): CostLogMetadata | undefined {
  if (!metadata) return undefined

  const sanitized = Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => {
      if (isSensitiveKey(key)) {
        return [key, '[redacted]']
      }

      if (typeof value === 'string' && value.length > 400) {
        return [key, `${value.slice(0, 397)}...`]
      }

      return [key, value]
    })
  )

  return sanitized
}

export function createCorrelationId(prefix = 'obs'): string {
  const randomPart = Math.random().toString(36).slice(2, 10)
  return `${prefix}-${Date.now()}-${randomPart}`
}

export function normalizeObservabilityError(error: unknown): ErrorShape {
  if (error instanceof Error) {
    return {
      code: 'INTERNAL_ERROR',
      message: error.message || 'Unexpected error',
    }
  }

  if (typeof error === 'string') {
    return {
      code: 'INTERNAL_ERROR',
      message: error,
    }
  }

  if (error && typeof error === 'object') {
    const maybeMessage = (error as { message?: unknown }).message
    if (typeof maybeMessage === 'string' && maybeMessage.length > 0) {
      return {
        code: 'INTERNAL_ERROR',
        message: maybeMessage,
      }
    }
  }

  return {
    code: 'INTERNAL_ERROR',
    message: 'Unexpected error',
  }
}

export function formatAiCostLog(input: AiCostLogInput) {
  return {
    event: 'ai_cost',
    at: new Date().toISOString(),
    correlationId: input.correlationId ?? createCorrelationId('ai'),
    userId: input.userId,
    generationId: input.generationId ?? null,
    provider: input.provider,
    model: input.model,
    usage: {
      totalTokens: input.totalTokens,
      costUsd: Number(input.costUsd.toFixed(6)),
    },
    metadata: sanitizeMetadata(input.metadata),
  }
}

export function logAiCost(input: AiCostLogInput): void {
  const payload = formatAiCostLog(input)
  console.info('[observability][ai_cost]', JSON.stringify(payload))
}
