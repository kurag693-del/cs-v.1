'use server'

import { createServerClient } from '@/lib/auth/supabase'
import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import crypto from 'node:crypto'

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

function hasSupabaseConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY))
}

function shouldUseSupabase() {
  const mode = process.env.AUTH_MODE?.toLowerCase() ?? 'auto'
  if (mode === 'local') return false
  if (mode === 'supabase') return true
  return hasSupabaseConfig()
}

export async function registerUser(formData: FormData) {
  const validated = registerSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!validated.success) {
    return {
      success: false,
      error: validated.error.issues[0]?.message || 'Invalid input',
    }
  }

  const { email, password } = validated.data
  try {
    if (!shouldUseSupabase()) {
      const existing = await prisma.user.findUnique({ where: { email } })
      if (existing) {
        return { success: false, error: 'User already exists' }
      }

      await prisma.user.create({
        data: {
          email,
          password,
          name: email.split('@')[0],
        },
      })

      return {
        success: true,
        message: 'Registration successful. You can now sign in.',
      }
    }

    const supabase = createServerClient()
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`,
      },
    })

    if (signUpError) {
      console.error('SignUp error:', signUpError)
      return {
        success: false,
        error: signUpError.message,
      }
    }

    if (!authData.user) {
      return {
        success: false,
        error: 'Failed to create user',
      }
    }

    // Profile bootstrap is skipped until Supabase table typing is aligned.

    return {
      success: true,
      message: 'Registration successful! Please check your email to confirm.',
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred'
    console.error('Registration error:', err)
    return {
      success: false,
      error: message,
    }
  }
}

export async function loginUser(formData: FormData) {
  const validated = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!validated.success) {
    return {
      success: false,
      error: validated.error.issues[0]?.message || 'Invalid input',
    }
  }

  const { email, password } = validated.data
  try {
    if (!shouldUseSupabase()) {
      const user = await prisma.user.findUnique({ where: { email } })
      if (!user || user.password !== password) {
        return {
          success: false,
          error: 'Invalid credentials',
        }
      }

      return {
        success: true,
        session: {
          access_token: `local_${crypto.randomUUID()}`,
          refresh_token: `local_refresh_${crypto.randomUUID()}`,
          expires_in: 3600,
          user: {
            id: user.id,
            email: user.email,
          },
        },
      }
    }

    const supabase = createServerClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error('Login error:', error)
      return {
        success: false,
        error: error.message,
      }
    }

    if (!data.session) {
      return {
        success: false,
        error: 'No session created',
      }
    }

    return {
      success: true,
      session: data.session,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred'
    console.error('Login error:', err)
    return {
      success: false,
      error: message,
    }
  }
}

export async function logoutUser() {
  const supabase = createServerClient()

  try {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Logout error:', error)
    }
  } catch (err) {
    console.error('Logout error:', err)
  }

  revalidatePath('/', 'layout')
  redirect('/login')
}
