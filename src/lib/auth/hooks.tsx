'use client'

import { useEffect, useState, useContext, createContext } from 'react'

type AuthContextType = {
  user: { id: string; email: string } | null
  session: { id: string } | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null)
  const [session, setSession] = useState<{ id: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('local-auth-user')
      const parsed = raw ? (JSON.parse(raw) as { id: string; email: string }) : null
      if (parsed?.id) {
        setUser(parsed)
        setSession({ id: 'local' })
      } else {
        setUser(null)
        setSession(null)
      }
    } catch {
      setUser(null)
      setSession(null)
    } finally {
      setLoading(false)
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
