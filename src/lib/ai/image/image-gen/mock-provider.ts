import type { GeneratedImageResult } from '@/lib/ai/image/image-gen/types'

/** Локальный SVG data URL — без внешних запросов (подходит для dev и тестов). */
function hash32(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i += 1) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(16)
}

export function generateMockImageDataUrl(prompt: string, size = 512): GeneratedImageResult {
  const id = hash32(prompt).slice(0, 8)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#334155"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><text x="50%" y="48%" fill="#e2e8f0" font-size="15" font-family="system-ui,sans-serif" text-anchor="middle">mock #${id}</text><text x="50%" y="56%" fill="#94a3b8" font-size="12" font-family="system-ui,sans-serif" text-anchor="middle">IMAGE_GEN_BACKEND=mock</text></svg>`
  const imageUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  return {
    imageUrl,
    backend: 'mock',
    providerLabel: 'mock-svg',
  }
}
