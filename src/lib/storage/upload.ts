'use server'

import { z } from 'zod'

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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const keyCandidates = [
    { name: 'service_role', key: process.env.SUPABASE_SERVICE_ROLE_KEY },
    { name: 'anon', key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
    { name: 'publishable', key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
  ].filter((item): item is { name: string; key: string } => Boolean(item.key))

  if (!supabaseUrl || keyCandidates.length === 0) {
    return { success: false as const, error: 'Не настроены ключи Supabase для загрузки файлов' }
  }

  const requestId = crypto.randomUUID()
  const maskKey = (value: string) => `${value.slice(0, 8)}...${value.slice(-6)}`
  console.info('[uploadImage] auth context', { requestId, userId, availableKeys: keyCandidates.map((item) => item.name) })

  const fileExt = file.name.split('.').pop() ?? 'jpg'
  const objectName = `${crypto.randomUUID()}.${fileExt}`
  const fileName = `${userId}/${objectName}`
  const fileBuffer = await file.arrayBuffer()
  const uploadUrl = `${supabaseUrl}/storage/v1/object/user-media/${encodeURIComponent(userId)}/${encodeURIComponent(objectName)}`

  const uploadErrors: Array<{ keyName: string; status?: number; message: string }> = []

  for (const candidate of keyCandidates) {
    try {
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          apikey: candidate.key,
          Authorization: `Bearer ${candidate.key}`,
          'Content-Type': file.type || 'image/jpeg',
          'x-upsert': 'false',
        },
        body: fileBuffer,
      })

      if (response.ok) {
        console.info('[uploadImage] upload success', {
          requestId,
          keyName: candidate.name,
          keyMask: maskKey(candidate.key),
          fileName,
        })
        return { success: true as const, url: `${supabaseUrl}/storage/v1/object/public/user-media/${fileName}` }
      }

      const errorBody = await response.text()
      uploadErrors.push({
        keyName: candidate.name,
        status: response.status,
        message: errorBody,
      })

      if (response.status === 404 && errorBody.includes('Bucket not found')) {
        console.error('[uploadImage] bucket missing', { requestId, keyName: candidate.name, body: errorBody })
        return { success: false as const, error: 'Bucket user-media не найден в Supabase Storage' }
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? `${error.message}${error.cause ? ` | cause: ${String(error.cause)}` : ''}` : 'Unknown upload error'
      uploadErrors.push({
        keyName: candidate.name,
        message,
      })
      console.error('[uploadImage] fetch exception', {
        requestId,
        keyName: candidate.name,
        keyMask: maskKey(candidate.key),
        message,
        stack: error instanceof Error ? error.stack : null,
      })
    }
  }

  console.error('[uploadImage] all key attempts failed', {
    requestId,
    fileName,
    errors: uploadErrors,
  })
  return { success: false as const, error: 'Ошибка загрузки: fetch failed (см. server logs)' }
}
