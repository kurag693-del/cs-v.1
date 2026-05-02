/**
 * Чистая логика раскладки на Canvas 2D (тестируемо без DOM).
 */

function splitOversizedWord(
  measure: (s: string) => number,
  word: string,
  maxWidth: number
): string[] {
  if (measure(word) <= maxWidth) return [word]
  const out: string[] = []
  let buf = ''
  for (const ch of word) {
    const next = buf + ch
    if (measure(next) > maxWidth && buf) {
      out.push(buf)
      buf = ch
    } else {
      buf = next
    }
  }
  if (buf) out.push(buf)
  return out
}

export function wrapTextLines(
  measure: (s: string) => number,
  text: string,
  maxWidth: number
): string[] {
  const t = text.trim()
  if (!t) return []
  const words = t.split(/\s+/).flatMap((w) => splitOversizedWord(measure, w, maxWidth))
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (measure(test) > maxWidth && line) {
      lines.push(line)
      line = w
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

/** object-fit: cover — обрезка по центру. */
export function coverSourceRect(
  imgW: number,
  imgH: number,
  boxW: number,
  boxH: number
): { sx: number; sy: number; sw: number; sh: number } {
  const scale = Math.max(boxW / imgW, boxH / imgH)
  const sw = boxW / scale
  const sh = boxH / scale
  const sx = Math.max(0, (imgW - sw) / 2)
  const sy = Math.max(0, (imgH - sh) / 2)
  return { sx, sy, sw, sh }
}
