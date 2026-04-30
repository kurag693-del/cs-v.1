import { validateSession } from '@/lib/auth/lucia'

export async function GET(request: Request) {
  const { user } = await validateSession()
  if (!user?.id) {
    return Response.redirect(new URL('/login', request.url), 302)
  }

  const url = new URL(request.url)
  const brandId = url.searchParams.get('brandId')
  if (!brandId) {
    return Response.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'brandId is required' } }, { status: 400 })
  }

  const clientId = process.env.VK_OAUTH_CLIENT_ID
  const redirectUri = process.env.VK_OAUTH_REDIRECT_URI
  if (!clientId || !redirectUri) {
    return Response.json(
      { success: false, error: { code: 'VK_OAUTH_NOT_CONFIGURED', message: 'VK OAuth env vars are missing' } },
      { status: 500 }
    )
  }

  const state = Buffer.from(JSON.stringify({ userId: user.id, brandId })).toString('base64url')
  const authUrl = new URL('https://oauth.vk.com/authorize')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', 'wall,photos,groups,offline')
  authUrl.searchParams.set('v', '5.199')
  authUrl.searchParams.set('state', state)

  return Response.redirect(authUrl, 302)
}
