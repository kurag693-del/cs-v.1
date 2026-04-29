import { S3Client } from '@aws-sdk/client-s3'

const endpoint = process.env.S3_ENDPOINT
const accessKeyId = process.env.S3_ACCESS_KEY
const secretAccessKey = process.env.S3_SECRET_KEY

if (!endpoint || !accessKeyId || !secretAccessKey) {
  throw new Error('S3 storage env is not configured')
}

const isR2 = endpoint.includes('r2.cloudflarestorage.com')

export const s3Client = new S3Client({
  region: isR2 ? 'auto' : 'ru-central1',
  endpoint,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  forcePathStyle: isR2,
})
