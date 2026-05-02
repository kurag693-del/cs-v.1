'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, Sparkles } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const result = await response.json()

      if (result.success) {
        setSuccess(result.data?.message || 'Registration successful!')
        setEmail('')
        setPassword('')
        setConfirmPassword('')
        setTimeout(() => {
          router.push('/login')
        }, 2000)
      } else {
        setError(result.error?.message || 'Registration failed')
      }
    } catch {
      setError('Network error while registering')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl items-center gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="hidden rounded-3xl border-border bg-card lg:block">
          <CardContent className="space-y-5 p-8">
            <Badge variant="secondary" className="w-fit">
              Рабочее пространство
            </Badge>
            <div className="space-y-3">
              <h1 className="text-4xl font-bold tracking-[-0.03em]">Создайте аккаунт</h1>
              <p className="text-[0.9375rem] text-muted-foreground">
                Запустите creator-first AI studio для генерации, планирования и публикации контента.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-secondary p-4">
              <p className="inline-flex items-center gap-2 text-[0.875rem] font-medium">
                <Sparkles className="h-4 w-4 text-primary" />
                Быстрый онбординг
              </p>
              <p className="mt-1 text-[0.8125rem] text-muted-foreground">
                Бренд, генерация с шаблоном ниши, календарь — по шагам после входа.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="w-full rounded-3xl border-border bg-card">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Create Account</CardTitle>
            <CardDescription className="text-center">Join Креатив-студия today</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              {success && <p className="text-sm text-green-600">{success}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creating...' : 'Sign Up'}
                {!loading ? <ArrowRight className="h-4 w-4" /> : null}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
