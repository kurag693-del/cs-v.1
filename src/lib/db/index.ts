import { PrismaClient } from '@prisma/client'
import { type Database } from '@/types/supabase'

export const prisma = new PrismaClient()

export const createClient = () => {
  const { createClient: createSupaClient } = require('@supabase/supabase-js')
  return createSupaClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  ) as any
}

export const createServerClientSSC = () => {
  const { createServerClient } = require('@supabase/auth-helpers-nextjs')
  const cookieStore = require('next/headers').cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    {
      cookies: {
        get: (name: string) => {
          try {
            return cookieStore.get(name)
          } catch {
            return null
          }
        },
        set: (name: string, value: string, options: any) => {
          try {
            ;(cookieStore as any).set(name, value, options)
          } catch {}
        },
        remove: (name: string, options: any) => {
          try {
            ;(cookieStore as any).delete(name, options)
          } catch {}
        },
      },
    }
  ) as any
}
