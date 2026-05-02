import { z } from 'zod'

export const generateRasterImageInputSchema = z.object({
  prompt: z.string().min(8, 'Опишите картинку подробнее').max(2000),
  width: z.number().int().min(256).max(1024).optional(),
  height: z.number().int().min(256).max(1024).optional(),
})

export type GenerateRasterImageInput = z.infer<typeof generateRasterImageInputSchema>
