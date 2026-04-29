import { Lucia, TimeSpan } from 'lucia'
import { PrismaAdapter } from '@lucia-auth/adapter-prisma'
import { cookies } from 'next/headers'

import { prisma } from '@/lib/db/prisma'

const adapter = new PrismaAdapter(prisma.session, prisma.user)

export const lucia = new Lucia(adapter, {
  sessionExpiresIn: new TimeSpan(30, 'd'),
  sessionCookie: {
    attributes: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    },
  },
  getUserAttributes: (attributes) => {
    const userRecord = attributes as { email?: string; name?: string | null }
    return {
      email: userRecord.email ?? '',
      name: userRecord.name ?? null,
    }
  },
})

export async function createSession(userId: string) {
  const session = await lucia.createSession(userId, {})
  const cookie = lucia.createSessionCookie(session.id)
  const cookieStore = await cookies()
  cookieStore.set(cookie.name, cookie.value, cookie.attributes)
  return session
}

export async function validateSession(sessionIdOverride?: string | null) {
  const cookieStore = await cookies()
  const sessionId = sessionIdOverride ?? cookieStore.get(lucia.sessionCookieName)?.value ?? null
  if (!sessionId) {
    return { session: null, user: null }
  }

  const result = await lucia.validateSession(sessionId)
  if (result.session && result.session.fresh) {
    const sessionCookie = lucia.createSessionCookie(result.session.id)
    cookieStore.set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes)
  }
  if (!result.session) {
    const blankCookie = lucia.createBlankSessionCookie()
    cookieStore.set(blankCookie.name, blankCookie.value, blankCookie.attributes)
  }
  return result
}

export async function invalidateSession() {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get(lucia.sessionCookieName)?.value ?? null
  if (sessionId) {
    await lucia.invalidateSession(sessionId)
  }
  const blankCookie = lucia.createBlankSessionCookie()
  cookieStore.set(blankCookie.name, blankCookie.value, blankCookie.attributes)
}
