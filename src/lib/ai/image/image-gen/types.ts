export type ImageGenBackendId = 'mock' | 'http' | 'yandex_art' | 'openrouter'

export type GeneratedImageResult = {
  imageUrl: string
  backend: ImageGenBackendId
  /** Источник для логов и UI */
  providerLabel: string
}
