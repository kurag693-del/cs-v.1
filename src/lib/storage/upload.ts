'use server'

import { PutObjectCommand, S3ServiceException } from '@aws-sdk/client-s3'
import { z } from 'zod'
import { s3Client } from '@/lib/storage/s3-client'

const UploadSchema = z.object({
  file: z
    .instanceof(File)
    .refine((file) => file.size <= 5 * 1024 * 1024, 'Макс. 5 МБ')
    .refine((file) => file.type.startsWith('image/'), 'Разрешены только изображения'),
  userId: z.string().min(1, 'Некорректный пользователь'),
})

export async function uploadImage(file: File, userId: string) {
  const validated = UploadSchema.safeParse({ file, userId })
  if (!validated.success) {
    return { success: false as const, error: validated.error.issues[0]?.message ?? 'Ошибка валидации' }
  }

  const bucket = process.env.S3_BUCKET
  const publicUrlBase = process.env.S3_PUBLIC_URL
  if (!bucket || !publicUrlBase) {
    return { success: false as const, error: 'S3 storage env is not configured' }
  }

  const fileExt = file.name.split('.').pop() ?? 'jpg'
  const key = `${userId}/${crypto.randomUUID()}.${fileExt}`
  const body = Buffer.from(await file.arrayBuffer())

  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: file.type || 'image/jpeg',
      })
    )
    return { success: true as const, url: `${publicUrlBase}/${key}` }
  } catch (error: unknown) {
    if (error instanceof S3ServiceException) {
      if (error.name === 'NoSuchBucket') {
        return { success: false as const, error: 'S3 bucket не найден (NoSuchBucket)' }
      }
      if (error.name === 'AccessDenied') {
        return { success: false as const, error: 'Доступ к S3 bucket запрещен (AccessDenied)' }
      }
      if (error.name === 'EntityTooLarge') {
        return { success: false as const, error: 'Файл слишком большой для S3 (EntityTooLarge)' }
      }
      return { success: false as const, error: `Ошибка S3: ${error.name} ${error.message}` }
    }
    return { success: false as const, error: error instanceof Error ? error.message : 'S3 upload failed' }
  }
}
