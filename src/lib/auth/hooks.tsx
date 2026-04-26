'use client'

import { createClient } from '@/lib/auth/supabase'
import { useEffect, useState, useContext, createContext } from 'react'
import type { User, Session } from '@supabase/supabase-js'

type AuthContextType = {
  user: User | null
  session: Session | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const useSupabase = Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

    if (!useSupabase) {
      try {
        const raw = window.localStorage.getItem('local-auth-user')
        const parsed = raw ? (JSON.parse(raw) as { id: string; email: string }) : null
        if (parsed?.id) {
          setUser({
            id: parsed.id,
            email: parsed.email,
          } as User)
        } else {
          setUser(null)
        }
      } catch {
        setUser(null)
      } finally {
        setSession(null)
        setLoading(false)
      }
      return
    }

    let isMounted = true
    const supabase = createClient()

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (!isMounted) return
      setSession(currentSession)
      setUser(currentSession?.user ?? null)
      setLoading(false)
    }).catch(() => {
      if (!isMounted) return
      setSession(null)
      setUser(null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      setLoading(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  return <AuthContext.Provider value={{ user, session, loading }}>{children}</AuthContext.Provider>
}

export const useSession = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useSession must be used within an AuthProvider')
  }
  return context
}
