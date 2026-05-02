import type { GeneratedImageResult } from '@/lib/ai/image/image-gen/types'

/**
 * Заготовка под Yandex Cloud / YandexART (URI из env).
 * Пока не подключена к официальному SDK: добавьте вызов после получения актуального контракт API из консоли Yandex Cloud.
 */
export async function generateImageYandexArtStub(_prompt: string): Promise<GeneratedImageResult> {
  void _prompt
  throw new Error(
    'YandexART: задайте реализацию под ваш проект в Yandex Cloud (модель image generation). См. комментарий в yandex-art-stub.ts и ROADMAP.'
  )
}
