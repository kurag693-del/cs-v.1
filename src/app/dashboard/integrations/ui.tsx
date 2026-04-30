'use client'

import { useEffect, useState } from 'react'
import { type Platform } from '@prisma/client'
import { useRouter, useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'

type BrandOption = { id: string; name: string }
type Credential = {
  id: string
  platform: Platform
  brandId: string
  isActive: boolean
  expiresAt: Date | null
  scopes: string[]
}

type IntegrationsClientProps = {
  brands: BrandOption[]
  initialCredentials: Credential[]
}

const CONNECTABLE_PLATFORMS: Platform[] = ['TELEGRAM', 'VK', 'DZEN', 'INSTAGRAM', 'FACEBOOK', 'LINKEDIN', 'TWITTER', 'YOUTUBE', 'TIKTOK']

export function IntegrationsClient({ brands, initialCredentials }: IntegrationsClientProps) {
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [credentials, setCredentials] = useState<Credential[]>(initialCredentials)
  const [platform, setPlatform] = useState<Platform>('TELEGRAM')
  const [brandId, setBrandId] = useState<string>(brands[0]?.id ?? '')
  const [accessToken, setAccessToken] = useState('')
  const [refreshToken, setRefreshToken] = useState('')
  const credentialMap = new Map(credentials.map((item) => [`${item.brandId}:${item.platform}`, item]))

  useEffect(() => {
    const connected = searchParams.get('vk_connected')
    const error = searchParams.get('vk_error')
    if (connected === '1') {
      toast({ title: 'VK подключен', description: 'OAuth завершен успешно' })
      router.replace('/dashboard/integrations')
    } else if (error) {
      toast({ title: 'VK OAuth ошибка', description: decodeURIComponent(error), variant: 'destructive' })
      router.replace('/dashboard/integrations')
    }
  }, [router, searchParams, toast])

  const reload = async () => {
    const res = await fetch('/api/platform-credentials', { method: 'GET' })
    const payload = (await res.json()) as { success: boolean; data?: Credential[]; error?: { message: string } }
    if (!res.ok || !payload.success) {
      toast({ title: 'Ошибка', description: payload.error?.message ?? 'Не удалось обновить список', variant: 'destructive' })
      return
    }
    setCredentials(payload.data ?? [])
  }

  const connect = async () => {
    if (!brandId || !accessToken.trim()) {
      toast({ title: 'Ошибка', description: 'Укажите бренд и access token', variant: 'destructive' })
      return
    }

    const res = await fetch('/api/platform-credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform,
        brandId,
        accessToken,
        refreshToken: refreshToken || undefined,
      }),
    })

    const payload = (await res.json()) as { success: boolean; error?: { message: string } }
    if (!res.ok || !payload.success) {
      toast({ title: 'Ошибка подключения', description: payload.error?.message ?? 'Не удалось подключить', variant: 'destructive' })
      return
    }

    toast({ title: 'Подключено', description: `${platform} подключен для выбранного бренда` })
    setAccessToken('')
    setRefreshToken('')
    await reload()
  }

  const disconnect = async (credentialId: string) => {
    const res = await fetch('/api/platform-credentials', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentialId }),
    })
    const payload = (await res.json()) as { success: boolean; error?: { message: string } }
    if (!res.ok || !payload.success) {
      toast({ title: 'Ошибка', description: payload.error?.message ?? 'Не удалось отключить', variant: 'destructive' })
      return
    }
    toast({ title: 'Отключено', description: 'Интеграция отключена' })
    await reload()
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Подключение платформ (sandbox)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <Select value={platform} onValueChange={(value) => setPlatform(value as Platform)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONNECTABLE_PLATFORMS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={brandId} onValueChange={setBrandId}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите бренд" />
              </SelectTrigger>
              <SelectContent>
                {brands.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input placeholder="Access token" value={accessToken} onChange={(event) => setAccessToken(event.target.value)} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Input placeholder="Refresh token (optional)" value={refreshToken} onChange={(event) => setRefreshToken(event.target.value)} />
            <Button onClick={connect}>Подключить платформу</Button>
          </div>

          {platform === 'VK' ? (
            <div className="pt-2">
              <Button variant="outline" asChild>
                <a href={`/api/platform-credentials/vk/connect?brandId=${encodeURIComponent(brandId)}`}>Подключить VK через OAuth</a>
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Мои подключения</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {credentials.length === 0 ? (
            <p className="text-sm text-muted-foreground">Подключений пока нет</p>
          ) : (
            credentials.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">{item.platform}</p>
                  <p className="text-xs text-muted-foreground">brandId: {item.brandId}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => disconnect(item.id)}>
                  Отключить
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Статус по брендам и платформам</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {brands.length === 0 ? (
            <p className="text-sm text-muted-foreground">Сначала создайте бренд, затем подключите платформы.</p>
          ) : (
            brands.map((brand) => (
              <div key={brand.id} className="rounded-md border p-3">
                <p className="mb-2 text-sm font-medium">{brand.name}</p>
                <div className="grid gap-2 md:grid-cols-3">
                  {['TELEGRAM', 'VK', 'DZEN'].map((platformName) => {
                    const key = `${brand.id}:${platformName}`
                    const isConnected = credentialMap.has(key)
                    return (
                      <div key={key} className="flex items-center justify-between rounded-md border px-3 py-2">
                        <span className="text-xs">{platformName}</span>
                        <span className={`text-xs ${isConnected ? 'text-green-600' : 'text-muted-foreground'}`}>
                          {isConnected ? 'Подключено' : 'Не подключено'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
