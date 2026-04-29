import { validateSession } from '@/lib/auth/lucia'

export async function getCurrentUser() {
  const { user } = await validateSession()
  return user
}
