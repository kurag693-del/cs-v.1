'use server'

import { randomBytes } from 'node:crypto'
import { sha256 } from '@oslojs/crypto/sha2'
import { encodeHexLowerCase } from '@oslojs/encoding'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createSession, invalidateSession } from '@/lib/auth/lucia'
import { prisma } from '@/lib/db/prisma'
import { getOnboardingProgress } from '@/lib/onboarding/actions'

const registerSchema = z.object({
  email: z.string().email('Некорректный email'),
  password: z.string().min(8, 'Пароль должен быть не короче 8 символов'),
})

const loginSchema = z.object({
  email: z.string().email('Некорректный email'),
  password: z.string().min(1, 'Пароль обязателен'),
})

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hashed = encodeHexLowerCase(sha256(new TextEncoder().encode(`${salt}:${password}`)))
  return `${salt}:${hashed}`
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const candidate = encodeHexLowerCase(sha256(new TextEncoder().encode(`${salt}:${password}`)))
  return candidate === hash
}

export async function registerUser(email: string, password: string) {
  const parsed = registerSchema.safeParse({ email, password })
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Ошибка валидации' }
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (existing) {
    return { success: false as const, error: 'Пользователь уже существует' }
  }

  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      passwordHash: hashPassword(parsed.data.password),
      name: parsed.data.email.split('@')[0],
    },
    select: { id: true, email: true, name: true },
  })
  await createSession(user.id)
  return { success: true as const, user }
}

export async function loginUser(email: string, password: string) {
  const parsed = loginSchema.safeParse({ email, password })
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Ошибка валидации' }
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, email: true, name: true, passwordHash: true },
  })
  if (!user || !verifyPassword(parsed.data.password, user.passwordHash || '')) {
    return { success: false as const, error: 'Неверный email или пароль' }
  }

  await createSession(user.id)
  return {
    success: true as const,
    user: { id: user.id, email: user.email, name: user.name },
  }
}

export async function logoutUser() {
  await invalidateSession()
  revalidatePath('/', 'layout')
  return { success: true as const }
}

// Backward-compatible aliases used by existing UI code.
export async function signInWithEmail(email: string, password: string) {
  return loginUser(email, password)
}

/**
 * Один server action: cookie сессии и решение о маршруте в одном запросе.
 * Два отдельных вызова (вход + getPostLoginRedirect) дают гонку: второй запрос
 * иногда приходит без cookie и пользователь уходит на /dashboard вместо /onboarding.
 */
export async function signInWithEmailAndNextPath(
  email: string,
  password: string
): Promise<
  | { success: true; user: { id: string; email: string; name: string | null }; redirectTo: '/onboarding' | '/dashboard' }
  | { success: false; error: string }
> {
  const result = await loginUser(email, password)
  if (!result.success) {
    return { success: false, error: result.error }
  }
  const progress = await getOnboardingProgress(result.user.id)
  const redirectTo: '/onboarding' | '/dashboard' =
    progress.success && !progress.data.isCompleted ? '/onboarding' : '/dashboard'
  return { success: true, user: result.user, redirectTo }
}

export async function signOut() {
  return logoutUser()
}
