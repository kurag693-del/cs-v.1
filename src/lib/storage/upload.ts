'use server'

import { PutObjectCommand, S3ServiceException } from '@aws-sdk/client-s3'
import { s3Client } from '@/lib/storage/s3-client'
import { UploadMediaSchema } from '@/lib/validation/media'

type UploadSuccessResult = {
  success: true
  data: {
    url: string
    metadata: {
      mimeType: string
      sizeBytes: number
      fileName: string
      key: string
    }
  }
}

type UploadErrorResult = {
  success: false
  error: {
    code:
      | 'VALIDATION_ERROR'
      | 'S3_CONFIG_ERROR'
      | 'S3_NO_SUCH_BUCKET'
      | 'S3_ACCESS_DENIED'
      | 'S3_ENTITY_TOO_LARGE'
      | 'S3_UPLOAD_ERROR'
      | 'INTERNAL_ERROR'
    message: string
  }
}

export async function uploadImage(file: File, userId: string): Promise<UploadSuccessResult | UploadErrorResult> {
  const validated = UploadMediaSchema.safeParse({ file, userId })
  if (!validated.success) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: validated.error.issues[0]?.message ?? 'Ошибка валидации',
      },
    }
  }

  const bucket = process.env.S3_BUCKET?.trim().replace(/^\/+|\/+$/g, '')
  const publicUrlBase = process.env.S3_PUBLIC_URL?.trim().replace(/\/+$/, '')
  if (!bucket || !publicUrlBase) {
    return {
      success: false,
      error: {
        code: 'S3_CONFIG_ERROR',
        message: 'S3 storage env is not configured',
      },
    }
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
    return {
      success: true,
      data: {
        url: `${publicUrlBase}/${key}`,
        metadata: {
          mimeType: file.type || 'image/jpeg',
          sizeBytes: file.size,
          fileName: file.name,
          key,
        },
      },
    }
  } catch (error: unknown) {
    if (error instanceof S3ServiceException) {
      if (error.name === 'NoSuchBucket') {
        return {
          success: false,
          error: {
            code: 'S3_NO_SUCH_BUCKET',
            message: `S3 bucket "${bucket}" не найден (NoSuchBucket). Проверьте S3_BUCKET, endpoint и регион.`,
          },
        }
      }
      if (error.name === 'AccessDenied') {
        return {
          success: false,
          error: {
            code: 'S3_ACCESS_DENIED',
            message: 'Доступ к S3 bucket запрещен (AccessDenied)',
          },
        }
      }
      if (error.name === 'EntityTooLarge') {
        return {
          success: false,
          error: {
            code: 'S3_ENTITY_TOO_LARGE',
            message: 'Файл слишком большой для S3 (EntityTooLarge)',
          },
        }
      }
      return {
        success: false,
        error: {
          code: 'S3_UPLOAD_ERROR',
          message: `Ошибка S3: ${error.name} ${error.message}`,
        },
      }
    }
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'S3 upload failed',
      },
    }
  }
}
