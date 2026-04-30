import { S3Client } from '@aws-sdk/client-s3'

const endpoint = process.env.S3_ENDPOINT?.trim().replace(/\/+$/, '')
const accessKeyId = process.env.S3_ACCESS_KEY
const secretAccessKey = process.env.S3_SECRET_KEY
const region = process.env.S3_REGION?.trim()

if (!endpoint || !accessKeyId || !secretAccessKey) {
  throw new Error('S3 storage env is not configured')
}

const isR2 = endpoint.includes('r2.cloudflarestorage.com')
const isLocalS3 = /localhost|127\.0\.0\.1|minio/i.test(endpoint)

export const s3Client = new S3Client({
  region: region || (isR2 ? 'auto' : 'ru-central1'),
  endpoint,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  // Local MinIO usually requires path-style bucket addressing.
  forcePathStyle: isR2 || isLocalS3,
})
