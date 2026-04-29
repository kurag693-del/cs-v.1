import { NextResponse } from 'next/server'

import { validateSession } from '@/lib/auth/lucia'

export async function GET() {
  const { user } = await validateSession()
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 })
  }
  const userWithEmail = user as { id: string; email?: string }
  return NextResponse.json({
    user: {
      id: userWithEmail.id,
      email: userWithEmail.email ?? '',
    },
  })
}
