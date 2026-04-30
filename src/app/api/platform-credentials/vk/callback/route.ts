import { connectPlatformCredential } from '@/lib/platform-credentials/actions'
import { validateSession } from '@/lib/auth/lucia'

export async function GET(request: Request) {
  const { user } = await validateSession()
  if (!user?.id) {
    return Response.redirect(new URL('/login', request.url), 302)
  }

  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const stateRaw = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  if (error) {
    return Response.redirect(new URL(`/dashboard/integrations?vk_error=${encodeURIComponent(error)}`, request.url), 302)
  }
  if (!code || !stateRaw) {
    return Response.redirect(new URL('/dashboard/integrations?vk_error=missing_code_or_state', request.url), 302)
  }

  let brandId = ''
  let stateUserId = ''
  try {
    const parsed = JSON.parse(Buffer.from(stateRaw, 'base64url').toString('utf8')) as { userId?: string; brandId?: string }
    brandId = parsed.brandId ?? ''
    stateUserId = parsed.userId ?? ''
  } catch {
    return Response.redirect(new URL('/dashboard/integrations?vk_error=invalid_state', request.url), 302)
  }

  if (!brandId || stateUserId !== user.id) {
    return Response.redirect(new URL('/dashboard/integrations?vk_error=state_mismatch', request.url), 302)
  }

  const clientId = process.env.VK_OAUTH_CLIENT_ID
  const clientSecret = process.env.VK_OAUTH_CLIENT_SECRET
  const redirectUri = process.env.VK_OAUTH_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) {
    return Response.redirect(new URL('/dashboard/integrations?vk_error=oauth_not_configured', request.url), 302)
  }

  const tokenUrl = new URL('https://oauth.vk.com/access_token')
  tokenUrl.searchParams.set('client_id', clientId)
  tokenUrl.searchParams.set('client_secret', clientSecret)
  tokenUrl.searchParams.set('redirect_uri', redirectUri)
  tokenUrl.searchParams.set('code', code)

  const response = await fetch(tokenUrl, { method: 'GET' })
  const payload = (await response.json()) as {
    access_token?: string
    expires_in?: number
    error?: string
    error_description?: string
  }

  if (!response.ok || !payload.access_token) {
    const reason = payload.error_description ?? payload.error ?? `status_${response.status}`
    return Response.redirect(new URL(`/dashboard/integrations?vk_error=${encodeURIComponent(reason)}`, request.url), 302)
  }

  const expiresAt = payload.expires_in ? new Date(Date.now() + payload.expires_in * 1000).toISOString() : undefined
  const connected = await connectPlatformCredential({
    platform: 'VK',
    brandId,
    accessToken: payload.access_token,
    expiresAt,
    scopes: ['wall', 'photos', 'groups', 'offline'],
  })

  if (!connected.success) {
    return Response.redirect(
      new URL(`/dashboard/integrations?vk_error=${encodeURIComponent(connected.error)}`, request.url),
      302
    )
  }

  return Response.redirect(new URL('/dashboard/integrations?vk_connected=1', request.url), 302)
}
