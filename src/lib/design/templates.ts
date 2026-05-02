/**
 * Пресеты холста для визуального редактора постов (фаза 12).
 * Размеры в пикселях под экспорт PNG; отображение в UI масштабируется CSS.
 */
export type DesignPresetId = 'instagram_square' | 'instagram_story' | 'telegram_wide'

export type DesignPreset = {
  id: DesignPresetId
  label: string
  description: string
  width: number
  height: number
  /** Отступы для текста (нижняя треть / safe zone) */
  safePadding: number
}

export const DESIGN_PRESETS: readonly DesignPreset[] = [
  {
    id: 'instagram_square',
    label: 'Пост 1:1',
    description: '1080×1080 — лента Instagram, VK, квадрат',
    width: 1080,
    height: 1080,
    safePadding: 64,
  },
  {
    id: 'instagram_story',
    label: 'Сторис 9:16',
    description: '1080×1920 — сторис, Reels обложка',
    width: 1080,
    height: 1920,
    safePadding: 72,
  },
  {
    id: 'telegram_wide',
    label: 'Широкий 16:9',
    description: '1280×720 — превью Telegram, YouTube',
    width: 1280,
    height: 720,
    safePadding: 48,
  },
] as const

export const MAX_EXPORT_BYTES = 5 * 1024 * 1024
export const MAX_EXPORT_SIDE = 2048

export function getDesignPresetById(id: string): DesignPreset | null {
  return DESIGN_PRESETS.find((p) => p.id === id) ?? null
}

export function clampCanvasDimensions(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, MAX_EXPORT_SIDE / Math.max(width, height))
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  }
}
