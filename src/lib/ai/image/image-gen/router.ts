import { generateImageViaHttp } from '@/lib/ai/image/image-gen/http-provider'
import { generateMockImageDataUrl } from '@/lib/ai/image/image-gen/mock-provider'
import type { GeneratedImageResult, ImageGenBackendId } from '@/lib/ai/image/image-gen/types'
import { generateImageYandexArtStub } from '@/lib/ai/image/image-gen/yandex-art-stub'

function resolveBackend(): ImageGenBackendId {
  const raw = process.env.IMAGE_GEN_BACKEND?.trim().toLowerCase()
  if (raw === 'http' || raw === 'yandex_art' || raw === 'mock') {
    return raw
  }
  return 'mock'
}

export type GenerateImageInput = {
  prompt: string
  width?: number
  height?: number
}

/**
 * Реестр бэкендов растровой картинки для поста (РФ: mock / свой HTTP-шлюз / будущий YandexART).
 */
export async function generateRasterImage(input: GenerateImageInput): Promise<GeneratedImageResult> {
  const width = input.width ?? 512
  const height = input.height ?? 512
  const backend = resolveBackend()

  switch (backend) {
    case 'mock':
      return generateMockImageDataUrl(input.prompt, Math.min(width, height))
    case 'http': {
      const url = process.env.IMAGE_GEN_HTTP_URL?.trim()
      if (!url) {
        throw new Error('IMAGE_GEN_BACKEND=http задан без IMAGE_GEN_HTTP_URL')
      }
      return generateImageViaHttp(input.prompt, width, height, {
        url,
        apiKey: process.env.IMAGE_GEN_HTTP_KEY?.trim(),
        responseUrlField: (process.env.IMAGE_GEN_HTTP_RESPONSE_URL_FIELD ?? 'url').trim(),
      })
    }
    case 'yandex_art':
      return generateImageYandexArtStub(input.prompt)
    default: {
      const _exhaustive: never = backend
      return _exhaustive
    }
  }
}
