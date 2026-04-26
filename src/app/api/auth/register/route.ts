import { fail, ok } from '@/lib/api/response'
import { registerUser } from '@/lib/auth/actions'

export async function POST(request: Request) {
  const payload = (await request.json()) as { email?: string; password?: string }
  if (!payload.email || !payload.password) {
    return fail('email and password are required', 400, 'INVALID_AUTH_INPUT')
  }

  const formData = new FormData()
  formData.set('email', payload.email)
  formData.set('password', payload.password)

  const result = await registerUser(formData)
  if (!result.success) {
    return fail(result.error ?? 'Registration failed', 400, 'REGISTER_FAILED')
  }

  return ok({ message: result.message ?? 'Registration successful' })
}
