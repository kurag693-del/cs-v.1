import { z } from 'zod'

export const generateTextInputSchema = z.object({
  topic: z.string().min(3, 'Тема должна содержать минимум 3 символа').max(500, 'Тема слишком длинная'),
  platform: z.enum(['Instagram', 'Telegram', 'VK', 'TikTok']),
  brandId: z.string().optional(),
  maxLength: z.number().int().min(80).max(5000),
  contentType: z.enum(['post', 'story', 'tips', 'announcement']).default('post'),
  toneOverride: z.enum(['brand', 'humor', 'formal']).default('brand'),
  includeEmojis: z.boolean().default(true),
})

export type GenerateTextInput = z.input<typeof generateTextInputSchema>
