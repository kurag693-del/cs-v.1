import { Platform } from '@prisma/client'

import {
  connectPlatformCredential,
  disconnectPlatformCredential,
  listMyPlatformCredentials,
} from '@/lib/platform-credentials/actions'

export async function GET() {
  const result = await listMyPlatformCredentials()
  if (!result.success) {
    return Response.json({ success: false, error: { code: 'UNAUTHORIZED', message: result.error } }, { status: 401 })
  }
  return Response.json({ success: true, data: result.data })
}

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    platform?: string
    brandId?: string
    accessToken?: string
    refreshToken?: string
    expiresAt?: string
    scopes?: string[]
  }

  if (!payload.platform || !payload.brandId) {
    return Response.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'platform and brandId are required' } },
      { status: 400 }
    )
  }

  const platforms: Platform[] = ['TELEGRAM', 'VK', 'DZEN', 'INSTAGRAM', 'FACEBOOK', 'LINKEDIN', 'TWITTER', 'YOUTUBE', 'TIKTOK']
  if (!platforms.includes(payload.platform as Platform)) {
    return Response.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Unsupported platform' } }, { status: 400 })
  }

  const result = await connectPlatformCredential({
    platform: payload.platform as Platform,
    brandId: payload.brandId,
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    expiresAt: payload.expiresAt,
    scopes: payload.scopes,
  })

  if (!result.success) {
    const status = result.error === 'Unauthorized' ? 401 : 400
    return Response.json({ success: false, error: { code: 'CONNECT_FAILED', message: result.error } }, { status })
  }

  return Response.json({ success: true, data: result.data })
}

export async function DELETE(request: Request) {
  const payload = (await request.json()) as { credentialId?: string }
  if (!payload.credentialId) {
    return Response.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'credentialId is required' } },
      { status: 400 }
    )
  }

  const result = await disconnectPlatformCredential(payload.credentialId)
  if (!result.success) {
    return Response.json({ success: false, error: { code: 'DISCONNECT_FAILED', message: result.error } }, { status: 401 })
  }

  return Response.json({ success: true })
}
