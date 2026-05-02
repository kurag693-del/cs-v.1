import { z } from 'zod'

export const MAX_MEDIA_FILE_SIZE_BYTES = 5 * 1024 * 1024
export const MAX_MEDIA_FILES_PER_POST = 10
export const IMAGE_MIME_WHITELIST = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const

export const MediaFileSchema = z
  .instanceof(File)
  .refine((file) => IMAGE_MIME_WHITELIST.includes(file.type as (typeof IMAGE_MIME_WHITELIST)[number]), 'Разрешены только изображения JPG, PNG, WEBP или GIF')
  .refine((file) => file.size <= MAX_MEDIA_FILE_SIZE_BYTES, 'Максимальный размер файла — 5 МБ')

/** URL поста: https или data:image (ИИ/mock без S3). */
export const postMediaUrlSchema = z
  .string()
  .min(1)
  .max(14 * 1024 * 1024)
  .refine(
    (s) => {
      if (s.startsWith('data:image/')) return true
      try {
        const u = new URL(s)
        return u.protocol === 'http:' || u.protocol === 'https:'
      } catch {
        return false
      }
    },
    { message: 'Некорректный адрес: нужен http(s) или data:image/…' }
  )

export const MediaUrlsSchema = z
  .array(postMediaUrlSchema)
  .max(MAX_MEDIA_FILES_PER_POST, 'Максимум 10 изображений')

export const UploadMediaSchema = z.object({
  file: MediaFileSchema,
  userId: z.string().min(1, 'Некорректный пользователь'),
})

export type UploadMediaInput = z.infer<typeof UploadMediaSchema>
