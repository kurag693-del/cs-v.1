import { fail, ok } from '@/lib/api/response'
import { loginUser } from '@/lib/auth/actions'

export async function POST(request: Request) {
  const payload = (await request.json()) as { email?: string; password?: string }
  if (!payload.email || !payload.password) {
    return fail('email and password are required', 400, 'INVALID_AUTH_INPUT')
  }

  const result = await loginUser(payload.email, payload.password)
  if (!result.success) {
    return fail(result.error ?? 'Login failed', 401, 'LOGIN_FAILED')
  }

  return ok({ user: result.user })
}
