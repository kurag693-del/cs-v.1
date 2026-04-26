'use client'

import { useSession } from '@/lib/auth/hooks'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function DashboardPage() {
  const { user, session, loading } = useSession()
  const router = useRouter()
  const [logs, setLogs] = useState<string[]>([])

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [loading, user, router])

  const testMiddleware = async () => {
    try {
      const res = await fetch('/api/test-auth', { credentials: 'include' })
      const raw = await res.text()
      const parsed = raw ? JSON.parse(raw) : { success: false, error: 'Empty response body' }
      setLogs((prev) => [...prev, `[${new Date().toISOString()}] ${JSON.stringify(parsed)}`])
    } catch (error) {
      setLogs((prev) => [
        ...prev,
        `[${new Date().toISOString()}] ${JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Invalid response format',
        })}`,
      ])
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <Button variant="outline" onClick={testMiddleware}>Test Auth Headers</Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>User Info</CardTitle>
              <CardDescription>Your account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>User ID:</strong> {user.id}</p>
              <p><strong>Created:</strong> {new Date(user.created_at).toLocaleDateString()}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Session</CardTitle>
              <CardDescription>Current authentication state</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p><strong>Provider:</strong> email</p>
              <p><strong>Expires:</strong> {session?.expires_at ? new Date(session.expires_at * 1000).toLocaleString() : 'N/A'}</p>
            </CardContent>
          </Card>
        </div>

        {logs.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Middleware Logs</CardTitle>
              <CardDescription>Auth header injection results</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-lg text-sm overflow-auto max-h-40">
                {logs.map((log, i) => (
                  <div key={i}>{log}</div>
                ))}
              </pre>
            </CardContent>
          </Card>
        )}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Analytics</CardTitle>
            <CardDescription>Open MVP analytics dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/dashboard/analytics">Открыть аналитику</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
