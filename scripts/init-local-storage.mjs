import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { S3Client, HeadBucketCommand, CreateBucketCommand, PutBucketPolicyCommand } from '@aws-sdk/client-s3'

function loadEnvFile(filePath) {
  const raw = readFileSync(filePath, 'utf-8')
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex < 0) continue
    const key = trimmed.slice(0, eqIndex).trim()
    if (!key || process.env[key]) continue
    let value = trimmed.slice(eqIndex + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

try {
  loadEnvFile(resolve(process.cwd(), '.env'))
} catch {
  // no-op; script validates required vars below
}

const endpoint = process.env.S3_ENDPOINT
const accessKeyId = process.env.S3_ACCESS_KEY
const secretAccessKey = process.env.S3_SECRET_KEY
const bucket = process.env.S3_BUCKET

if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
  console.error('[init-local-storage] Missing S3 env vars. Required: S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET')
  process.exit(1)
}

const client = new S3Client({
  region: 'us-east-1',
  endpoint,
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: true,
})

async function ensureBucketExists() {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }))
    console.log(`[init-local-storage] Bucket exists: ${bucket}`)
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }))
    console.log(`[init-local-storage] Bucket created: ${bucket}`)
  }
}

async function ensurePublicReadPolicy() {
  const policy = {
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'PublicReadObjects',
        Effect: 'Allow',
        Principal: '*',
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${bucket}/*`],
      },
    ],
  }
  await client.send(
    new PutBucketPolicyCommand({
      Bucket: bucket,
      Policy: JSON.stringify(policy),
    })
  )
  console.log('[init-local-storage] Public read policy applied')
}

try {
  await ensureBucketExists()
  await ensurePublicReadPolicy()
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown S3 initialization error'
  console.error(`[init-local-storage] Failed: ${message}`)
  console.error('[init-local-storage] Ensure MinIO is running and S3_* env vars are correct')
  process.exit(1)
}
