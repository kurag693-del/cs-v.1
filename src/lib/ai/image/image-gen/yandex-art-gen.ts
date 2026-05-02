import type { GeneratedImageResult } from '@/lib/ai/image/image-gen/types'

const IMAGE_GEN_ASYNC_URL =
  'https://llm.api.cloud.yandex.net/foundationModels/v1/imageGenerationAsync'
const OPERATIONS_URL_BASE = 'https://operation.api.cloud.yandex.net/operations'

const POLL_INTERVAL_MS = 2000
const POLL_MAX_ATTEMPTS = 90

type YandexOperation = {
  id?: string
  done?: boolean
  error?: { code?: number; message?: string }
  response?: {
    image?: string
    modelVersion?: string
    '@type'?: string
  } | null
}

export function simplifyAspectRatio(width: number, height: number): { widthRatio: string; heightRatio: string } {
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))
  let a = w
  let b = h
  while (b !== 0) {
    const t = b
    b = a % b
    a = t
  }
  const g = a || 1
  return { widthRatio: String(w / g), heightRatio: String(h / g) }
}

function parseOperation(json: unknown): YandexOperation {
  if (!json || typeof json !== 'object') return {}
  return json as YandexOperation
}

function extractImageBase64(operation: YandexOperation): string | null {
  const img = operation.response?.image
  if (typeof img === 'string' && img.length > 0) return img
  return null
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * YandexART (Foundation Models): async image generation + poll Operation API.
 * Требуется `YANDEX_GPT_API_KEY` и `YANDEX_ART_MODEL_URI` (например `art://<folder-id>/yandex-art/latest`).
 */
export async function generateImageYandexArt(
  prompt: string,
  width: number,
  height: number
): Promise<GeneratedImageResult> {
  const apiKey = process.env.YANDEX_GPT_API_KEY?.trim()
  const modelUri = process.env.YANDEX_ART_MODEL_URI?.trim()

  if (!apiKey) {
    throw new Error('YandexART: задайте YANDEX_GPT_API_KEY (тот же ключ, что для Foundation Models)')
  }
  if (!modelUri) {
    throw new Error('YandexART: задайте YANDEX_ART_MODEL_URI (URI модели генерации изображений)')
  }

  const { widthRatio, heightRatio } = simplifyAspectRatio(width, height)
  const mimeType = process.env.YANDEX_ART_MIME_TYPE?.trim() || 'image/jpeg'

  const body = {
    modelUri,
    messages: [{ text: prompt, weight: '1' }],
    generationOptions: {
      mimeType,
      seed: '0',
      aspectRatio: {
        widthRatio,
        heightRatio,
      },
    },
  }

  const start = await fetch(IMAGE_GEN_ASYNC_URL, {
    method: 'POST',
    headers: {
      Authorization: `Api-Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  })

  if (!start.ok) {
    const text = await start.text().catch(() => '')
    throw new Error(`YandexART imageGenerationAsync: ${start.status} ${text.slice(0, 500)}`)
  }

  let operation = parseOperation(await start.json())
  const opId = operation.id
  if (!opId) {
    throw new Error('YandexART: в ответе нет id операции')
  }

  let imageB64 = extractImageBase64(operation)

  if (!imageB64 && operation.done === true) {
    if (operation.error?.message) {
      throw new Error(`YandexART: ${operation.error.message}`)
    }
    throw new Error('YandexART: операция завершена без изображения в ответе')
  }

  let attempts = 0
  while (!imageB64 && attempts < POLL_MAX_ATTEMPTS) {
    await sleep(POLL_INTERVAL_MS)
    attempts += 1

    const poll = await fetch(`${OPERATIONS_URL_BASE}/${encodeURIComponent(opId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Api-Key ${apiKey}`,
      },
      signal: AbortSignal.timeout(60_000),
    })

    if (!poll.ok) {
      const text = await poll.text().catch(() => '')
      throw new Error(`YandexART operations GET: ${poll.status} ${text.slice(0, 400)}`)
    }

    operation = parseOperation(await poll.json())
    imageB64 = extractImageBase64(operation)

    if (operation.done === true) {
      if (operation.error?.message) {
        throw new Error(`YandexART: ${operation.error.message}`)
      }
      break
    }
  }

  if (!imageB64) {
    throw new Error('YandexART: превышено время ожидания генерации')
  }

  const modelVersion = operation.response?.modelVersion ?? modelUri
  const dataUrl = `data:${mimeType};base64,${imageB64}`

  return {
    imageUrl: dataUrl,
    backend: 'yandex_art',
    providerLabel: `YandexART · ${modelVersion}`,
  }
}
