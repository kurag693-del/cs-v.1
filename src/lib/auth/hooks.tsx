'use client'

import { useEffect, useState, useContext, createContext } from 'react'

type AuthContextType = {
  user: { id: string; email: string } | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const fetchSession = async () => {
      try {
        const response = await fetch('/api/auth/session', { cache: 'no-store' })
        if (!isMounted) return
        if (!response.ok) {
          setUser(null)
          return
        }
        const payload = (await response.json()) as { user?: { id: string; email: string } }
        setUser(payload.user ?? null)
      } catch {
        if (isMounted) {
          setUser(null)
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    void fetchSession()
    return () => {
      isMounted = false
    }
  }, [])

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>
}

export const useSession = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useSession must be used within an AuthProvider')
  }
  return context
}
