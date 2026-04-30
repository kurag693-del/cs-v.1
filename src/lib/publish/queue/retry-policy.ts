export const MAX_PUBLISH_ATTEMPTS = 5

export function getRetryDelayMs(attempt: number): number {
  const safeAttempt = Math.max(1, attempt)
  const base = 10_000
  const exponential = base * Math.pow(2, safeAttempt - 1)
  const jitter = Math.floor(Math.random() * 1_500)
  return Math.min(exponential + jitter, 10 * 60 * 1000)
}

export function shouldMoveToDlq(attempt: number): boolean {
  return attempt >= MAX_PUBLISH_ATTEMPTS
}
