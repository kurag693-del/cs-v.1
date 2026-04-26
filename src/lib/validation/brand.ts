import { z } from 'zod'

export const CreateBrandSchema = z.object({
  name: z.string().min(2, 'Название должно быть не менее 2 символов').max(100, 'Название не должно превышать 100 символов'),
  description: z.string().max(500, 'Описание не должно превышать 500 символов').optional(),
  tone: z.string().min(2, 'Тон должен быть не менее 2 символов').max(50, 'Тон не должен превышать 50 символов'),
  voice: z.string().min(2, 'Голос бренда должен быть не менее 2 символов').max(100, 'Голос бренда не должен превышать 100 символов').optional(),
  colors: z.array(z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Цвет должен быть в формате HEX')).max(5, 'Максимум 5 цветов').optional(),
  forbiddenWords: z.array(z.string().min(1)).optional(),
  examples: z.string().max(2000, 'Примеры не должны превышать 2000 символов').optional(),
  website: z.string().url('Некорректный URL').optional().or(z.literal('')),
  industry: z.string().max(100, 'Отрасль не должна превышать 100 символов').optional(),
  isActive: z.boolean().optional(),
})

export const UpdateBrandSchema = CreateBrandSchema.partial()

export type CreateBrandInput = z.infer<typeof CreateBrandSchema>
export type UpdateBrandInput = z.infer<typeof UpdateBrandSchema>

export type Result<T, E = Error> = {
  success: true
  data: T
} | {
  success: false
  error: string
  details?: any
}
