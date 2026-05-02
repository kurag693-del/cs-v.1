import { z } from 'zod'

import { aiProviderIdSchema } from './ai-provider'

export const generateTextInputSchema = z.object({
  topic: z.string().min(3, 'Тема должна содержать минимум 3 символа').max(500, 'Тема слишком длинная'),
  platform: z.enum(['Instagram', 'Telegram', 'VK', 'TikTok']),
  provider: aiProviderIdSchema.default('deepseek'),
  brandId: z.string().optional(),
  maxLength: z.number().int().min(80).max(5000),
  contentType: z.enum(['post', 'story', 'tips', 'announcement']).default('post'),
  toneOverride: z.enum(['brand', 'humor', 'formal']).default('brand'),
  includeEmojis: z.boolean().default(true),
  enableAbTest: z.boolean().default(false),
  variantsCount: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
  autoHashtags: z.boolean().default(true),
  enableRecycle: z.boolean().default(false),
  recycleTargets: z.array(z.enum(['Instagram', 'Telegram', 'VK', 'TikTok', 'Dzen'])).default([]),
  /** Встроенный шаблон ниши; передаётся в server action вместе с формой. */
  templateId: z.string().min(1).max(80).optional(),
})

export type GenerateTextInput = z.input<typeof generateTextInputSchema>
