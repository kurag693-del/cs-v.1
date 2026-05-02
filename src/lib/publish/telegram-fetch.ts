import { Agent, fetch as undiciFetch, type RequestInit as UndiciRequestInit } from 'undici'

/**
 * Глобальный fetch в Node использует undici с дефолтным connect timeout ~10s —
 * до api.telegram.org из части сетей (РФ, корп. файрволы) этого мало.
 */
function telegramAgent(): Agent {
  const connectMs = clampMs(process.env.TELEGRAM_CONNECT_TIMEOUT_MS, 35_000, 5_000, 120_000)
  const bodyMs = clampMs(process.env.TELEGRAM_BODY_TIMEOUT_MS, 180_000, 10_000, 300_000)
  return new Agent({
    connect: { timeout: connectMs },
    bodyTimeout: bodyMs,
    headersTimeout: Math.min(bodyMs, 120_000),
  })
}

function clampMs(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (!raw?.trim()) return fallback
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

let cached: Agent | null = null
function getAgent(): Agent {
  if (!cached) cached = telegramAgent()
  return cached
}

/** Вызов к https://api.telegram.org с увеличенными таймаутами подключения и тела ответа. */
export async function fetchTelegramApi(url: string, init: RequestInit) {
  return undiciFetch(url, {
    method: init.method,
    headers: init.headers,
    body: init.body ?? undefined,
    dispatcher: getAgent(),
  } as UndiciRequestInit)
}
