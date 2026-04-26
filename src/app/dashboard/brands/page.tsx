'use client'

import { useSession } from '@/lib/auth/hooks'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { BrandList } from '@/components/features/BrandList'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function BrandsPage() {
  const { user, session, loading } = useSession()
  const router = useRouter()
  const [initialBrands, setInitialBrands] = useState<any[]>([])
  const [brandsLoading, setBrandsLoading] = useState(true)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [loading, user, router])

  useEffect(() => {
    if (user) {
      fetchBrands()
    }
  }, [user])

  const fetchBrands = async () => {
    try {
      const res = await fetch(`/api/brands?userId=${user?.id}`)
      const data = await res.json()
      if (data.success) {
        setInitialBrands(data.data)
      }
    } catch (err) {
      console.error('Failed to fetch brands:', err)
    } finally {
      setBrandsLoading(false)
    }
  }

  if (loading || brandsLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-10 w-48" />
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-32" />
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
      <div className="max-w-6xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Управление брендами</CardTitle>
            <CardDescription>
              Создавайте и управляйте брендами для генерации контента
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BrandList userId={user.id} initialBrands={initialBrands} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
