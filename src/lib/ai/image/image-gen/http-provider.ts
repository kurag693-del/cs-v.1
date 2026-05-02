import type { GeneratedImageResult } from '@/lib/ai/image/image-gen/types'

type HttpImageEnv = {
  url: string
  apiKey: string | undefined
  /** Имя поля JSON с URL картинки (напр. url, image_url, result). */
  responseUrlField: string
}

function pickUrl(json: unknown, field: string): string | null {
  if (!json || typeof json !== 'object') return null
  const o = json as Record<string, unknown>
  const direct = o[field]
  if (typeof direct === 'string' && direct.startsWith('http')) return direct
  const data = o.data
  if (Array.isArray(data) && data[0] && typeof data[0] === 'object') {
    const first = data[0] as Record<string, unknown>
    const u = first[field] ?? first.url ?? first.image_url
    if (typeof u === 'string' && u.startsWith('http')) return u
  }
  return null
}

/**
 * Универсальный HTTP-бэкенд для РФ-совместимых API (прокси к FusionBrain / Kandinsky / своему шлюзу).
 * Ожидается POST JSON `{ prompt, width?, height? }` и ответ с URL изображения.
 */
export async function generateImageViaHttp(
  prompt: string,
  width: number,
  height: number,
  env: HttpImageEnv
): Promise<GeneratedImageResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  if (env.apiKey) {
    headers.Authorization = `Bearer ${env.apiKey}`
  }

  const res = await fetch(env.url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ prompt, width, height }),
    signal: AbortSignal.timeout(120_000),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`IMAGE_HTTP ${res.status}: ${text.slice(0, 200)}`)
  }

  const json: unknown = await res.json().catch(() => null)
  const imageUrl = pickUrl(json, env.responseUrlField)
  if (!imageUrl) {
    throw new Error('IMAGE_HTTP: в ответе нет URL изображения (проверьте IMAGE_GEN_HTTP_RESPONSE_URL_FIELD)')
  }

  return {
    imageUrl,
    backend: 'http',
    providerLabel: 'http-json',
  }
}
