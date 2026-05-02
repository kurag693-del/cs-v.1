/**
 * Разбор первого медиа для публикации в каналы.
 * Без S3: допускаются HTTPS от внешнего API генерации и data URL (mock / локальный превью).
 */

export type ParsedFirstMedia =
  | { kind: 'none' }
  | { kind: 'remote'; url: string }
  | { kind: 'data'; buffer: Buffer; mimeType: string; filename: string }

const MAX_INLINE_PROXY_BYTES = 3 * 1024 * 1024

export function parseFirstMediaUrl(mediaUrls: string[]): ParsedFirstMedia {
  const raw = mediaUrls[0]?.trim()
  if (!raw) return { kind: 'none' }

  if (raw.startsWith('https://') || raw.startsWith('http://')) {
    return { kind: 'remote', url: raw }
  }

  if (raw.startsWith('data:')) {
    const payload = raw.slice('data:'.length)
    const comma = payload.indexOf(',')
    if (comma === -1) return { kind: 'none' }
    const meta = payload.slice(0, comma)
    const dataPart = payload.slice(comma + 1)
    const mimeType = meta.split(';')[0]?.trim() || 'application/octet-stream'
    const isBase64 = /;base64/i.test(meta)

    let buffer: Buffer
    try {
      if (isBase64) {
        buffer = Buffer.from(dataPart, 'base64')
      } else {
        buffer = Buffer.from(decodeURIComponent(dataPart), 'utf8')
      }
    } catch {
      return { kind: 'none' }
    }

    if (buffer.length === 0) return { kind: 'none' }

    const ext =
      mimeType.includes('svg') ? 'svg' : mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg'

    return {
      kind: 'data',
      buffer,
      mimeType,
      filename: `post-media.${ext}`,
    }
  }

  return { kind: 'none' }
}

/** Для JSON-прокси: укладываем base64 только если объём приемлемый. */
export function inlineMediaForProxyPayload(parsed: ParsedFirstMedia):
  | { inlineBase64: string; mimeType: string; filename: string }
  | undefined {
  if (parsed.kind !== 'data') return undefined
  if (parsed.buffer.length > MAX_INLINE_PROXY_BYTES) return undefined
  return {
    inlineBase64: parsed.buffer.toString('base64'),
    mimeType: parsed.mimeType,
    filename: parsed.filename,
  }
}
