import {
  resolveOpenRouterAppTitle,
  resolveOpenRouterHttpReferer,
} from '@/lib/ai/providers/openrouter-config'
import type { GeneratedImageResult } from '@/lib/ai/image/image-gen/types'

const DEFAULT_IMAGE_MODEL = 'black-forest-labs/flux-schnell'

function pickImageSize(width: number, height: number): string {
  const max = Math.max(width, height)
  if (max <= 256) return '256x256'
  if (max <= 512) return '512x512'
  return '1024x1024'
}

type OpenAIStyleImageResponse = {
  data?: Array<{ url?: string; b64_json?: string }>
  error?: { message?: string }
}

function resolveImageModel(): string {
  return (
    process.env.OPENROUTER_IMAGE_MODEL?.trim() ||
    process.env.OPENROUTER_MODEL?.trim() ||
    DEFAULT_IMAGE_MODEL
  )
}

/**
 * OpenRouter OpenAI-совместимый endpoint `/v1/images/generations` (модель — аргумент или env).
 */
export async function generateImageOpenRouter(
  prompt: string,
  width: number,
  height: number,
  explicitModel?: string
): Promise<GeneratedImageResult> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY не задан (нужен для IMAGE_GEN_BACKEND=openrouter)')
  }

  const model = explicitModel?.trim() || resolveImageModel()
  const url = 'https://openrouter.ai/api/v1/images/generations'

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': resolveOpenRouterHttpReferer(),
      'X-Title': resolveOpenRouterAppTitle(),
    },
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      size: pickImageSize(width, height),
    }),
    signal: AbortSignal.timeout(120_000),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`OpenRouter images ${res.status}: ${text.slice(0, 400)}`)
  }

  const data = (await res.json()) as OpenAIStyleImageResponse
  if (data.error?.message) {
    throw new Error(`OpenRouter images: ${data.error.message}`)
  }

  const first = data.data?.[0]
  let imageUrl: string
  if (first?.url && first.url.startsWith('http')) {
    imageUrl = first.url
  } else if (first?.b64_json && first.b64_json.length > 0) {
    imageUrl = `data:image/png;base64,${first.b64_json}`
  } else {
    throw new Error('OpenRouter images: в ответе нет url или b64_json')
  }

  return {
    imageUrl,
    backend: 'openrouter',
    providerLabel: `OpenRouter · ${model}`,
  }
}
