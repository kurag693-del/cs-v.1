import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

export const authClient = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
) as any

export async function getCurrentUser() {
  try {
    const { data } = await authClient.auth.getUser()
    return data.user
  } catch {
    return null
  }
}

export async function getUserProfile(userId: string) {
  const { data, error } = await authClient
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) throw error
  return data
}

export async function updateUserProfile(userId: string, updates: Record<string, any>) {
  const { data, error } = await authClient
    .from('profiles')
    .update(updates)
    .eq('id', userId)

  if (error) throw error
  return data
}

export const authHelpers = {
  signInWithEmail: async (email: string, password: string) => {
    const { data, error } = await authClient.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
    return data
  },

  signUp: async (email: string, password: string, metadata?: any) => {
    const { data, error } = await authClient.auth.signUp({
      email,
      password,
      options: { data: metadata },
    })
    if (error) throw error
    return data
  },

  signOut: async () => {
    const { error } = await authClient.auth.signOut()
    if (error) throw error
  },
}
