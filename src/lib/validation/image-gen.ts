import { z } from 'zod'

export const generateRasterImageInputSchema = z.object({
  prompt: z.string().min(8, 'Опишите картинку подробнее').max(2000),
  width: z.number().int().min(256).max(1024).optional(),
  height: z.number().int().min(256).max(1024).optional(),
  /** Только для IMAGE_GEN_BACKEND=openrouter; slug из AI_IMAGE_MODELS_* . */
  imageModel: z.string().min(1).max(200).optional(),
})

export type GenerateRasterImageInput = z.infer<typeof generateRasterImageInputSchema>
