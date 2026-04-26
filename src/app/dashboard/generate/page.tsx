'use client'

import { useSession } from '@/lib/auth/hooks'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { TextGenerator } from '@/components/features/TextGenerator'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function GeneratePage() {
  const { user, session, loading } = useSession()
  const router = useRouter()
  const [availableBrands, setAvailableBrands] = useState<Array<{ id: string; name: string }>>([])
  const [credits, setCredits] = useState(0)
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [loading, user, router])

  useEffect(() => {
    if (user) {
      fetchUserData()
    }
  }, [user])

  const fetchUserData = async () => {
    try {
      const [brandsRes, creditsRes] = await Promise.all([
        fetch(`/api/brands?userId=${user?.id}`).then(r => r.json()),
        fetch(`/api/credits?userId=${user?.id}`).then(r => r.json()),
      ])

      if (brandsRes.success) {
        setAvailableBrands(brandsRes.data)
      }

      if (creditsRes.success) {
        setCredits(creditsRes.data.available)
      } else {
        setCredits(100)
      }
    } catch (err) {
      console.error('Failed to fetch user data:', err)
    } finally {
      setLoadingData(false)
    }
  }

  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-10 w-64" />
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Генерация контента</CardTitle>
            <CardDescription>
              Создайте контент с помощью AI. Осталось кредитов:{' '}
              <span className="font-bold text-lg">{credits}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {availableBrands.length === 0 && (
              <div className="mb-4 rounded-md border bg-muted/40 p-4">
                <p className="text-sm mb-3">
                  У вас пока нет брендов. Создайте бренд, чтобы генерация учитывала tone/voice.
                </p>
                <Button asChild size="sm" variant="outline">
                  <Link href="/dashboard/brands">Создать бренд</Link>
                </Button>
              </div>
            )}
            {credits <= 0 && (
              <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-4">
                <p className="text-sm mb-3">Кредиты закончились. Для продолжения перейдите на платный тариф.</p>
                <Button asChild size="sm">
                  <Link href="/pricing">Открыть тарифы</Link>
                </Button>
              </div>
            )}
            <TextGenerator
              userId={user.id}
              profileId={undefined}
              availableBrands={availableBrands}
              credits={credits}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
