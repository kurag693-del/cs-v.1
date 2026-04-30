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
const SUPPORTED_GUIDE_PLATFORMS = ['TELEGRAM', 'VK', 'DZEN'] as const satisfies readonly Platform[]
type SupportedGuidePlatform = (typeof SUPPORTED_GUIDE_PLATFORMS)[number]

function isSupportedGuidePlatform(platform: Platform): platform is SupportedGuidePlatform {
  return SUPPORTED_GUIDE_PLATFORMS.includes(platform as SupportedGuidePlatform)
}

const platformInstructions: Record<SupportedGuidePlatform, { access: string; refresh: string; steps: string[]; bestWay: string }> = {
  TELEGRAM: {
    access: 'Это токен бота Telegram. Он выглядит как длинная строка вида 123456:AA....',
    refresh: 'Обычно не нужен. Для Telegram Bot API чаще всего оставляйте поле пустым.',
    bestWay: 'Самый удобный путь: создать отдельного бота для автопубликации и выдать ему права на публикацию в вашем канале.',
    steps: [
      'Откройте Telegram и найдите @BotFather.',
      'Введите команду /newbot и создайте бота (имя и username).',
      'BotFather пришлет HTTP API token — это и есть Access token.',
      'Добавьте бота в свой канал и назначьте его администратором с правом публикации.',
      'Вставьте токен в поле Access token, поле Refresh token оставьте пустым.',
    ],
  },
  VK: {
    access: 'Это ключ доступа к API VK от имени вашего приложения/сообщества.',
    refresh: 'Токен для продления доступа без повторного входа. В sandbox можно не заполнять, в production лучше хранить.',
    bestWay: 'Рекомендуемый способ: кнопка “Подключить VK через OAuth” ниже формы. Это безопаснее и удобнее ручного копирования токенов.',
    steps: [
      'Нажмите “Подключить VK через OAuth” и разрешите доступ.',
      'После возврата на страницу подключение сохранится автоматически.',
      'Если подключаете вручную: создайте приложение VK, получите access token, вставьте его в форму.',
      'Refresh token (если выдается вашим сценарием OAuth) вставьте в поле Refresh token.',
    ],
  },
  DZEN: {
    access: 'Это OAuth access token Яндекс/Dzen для публикации контента.',
    refresh: 'Токен обновления доступа. Обычно выдается вместе с access token в OAuth-потоке.',
    bestWay: 'Лучше использовать OAuth-сценарий вашего приложения, чтобы пользователь не копировал токены вручную.',
    steps: [
      'Создайте OAuth-приложение в кабинете разработчика Яндекс.',
      'Запросите доступ к публикации в Dzen и получите access token.',
      'Если OAuth вернул refresh token — добавьте его во второе поле.',
      'Сохраните подключение через кнопку “Подключить платформу”.',
    ],
  },
}

export function IntegrationsClient({ brands, initialCredentials }: IntegrationsClientProps) {
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [credentials, setCredentials] = useState<Credential[]>(initialCredentials)
  const [platform, setPlatform] = useState<Platform>('TELEGRAM')
  const [brandId, setBrandId] = useState<string>(brands[0]?.id ?? '')
  const [accessToken, setAccessToken] = useState('')
  const [refreshToken, setRefreshToken] = useState('')
  const [telegramChatId, setTelegramChatId] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [lastConnectedKey, setLastConnectedKey] = useState<string | null>(null)
  const credentialMap = new Map(credentials.map((item) => [`${item.brandId}:${item.platform}`, item]))
  const selectedKey = `${brandId}:${platform}`
  const selectedCredential = credentialMap.get(selectedKey)
  const isSelectedConnected = Boolean(selectedCredential)
  const guideInfo = isSupportedGuidePlatform(platform) ? platformInstructions[platform] : null

  const chatIdFromScopes = selectedCredential?.scopes.find((scope) => scope.startsWith('chat_id:'))?.slice('chat_id:'.length) ?? ''
  const effectiveTelegramChatId = telegramChatId || chatIdFromScopes

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
    if (!brandId) {
      toast({ title: 'Ошибка', description: 'Укажите бренд', variant: 'destructive' })
      return
    }
    if (!isSelectedConnected && !accessToken.trim()) {
      toast({ title: 'Ошибка', description: 'Для первого подключения укажите access token', variant: 'destructive' })
      return
    }
    if (platform === 'TELEGRAM' && !effectiveTelegramChatId.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Для Telegram укажите chat_id или @channel_username канала',
        variant: 'destructive',
      })
      return
    }

    try {
      setIsConnecting(true)
      const res = await fetch('/api/platform-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          brandId,
          accessToken: accessToken.trim() || undefined,
          refreshToken: refreshToken || undefined,
          scopes:
            platform === 'TELEGRAM' && effectiveTelegramChatId.trim().length > 0
              ? [`chat_id:${effectiveTelegramChatId.trim()}`]
              : undefined,
        }),
      })

      const payload = (await res.json()) as { success: boolean; error?: { message: string } }
      if (!res.ok || !payload.success) {
        toast({ title: 'Ошибка подключения', description: payload.error?.message ?? 'Не удалось подключить', variant: 'destructive' })
        return
      }

      await reload()
      setLastConnectedKey(`${brandId}:${platform}`)
      toast({ title: 'Подключено', description: `${platform} подключен для выбранного бренда` })
    } finally {
      setIsConnecting(false)
    }
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
    <div className="max-w-full space-y-6 overflow-x-hidden">
      <Card>
        <CardHeader>
          <CardTitle>Подключение платформ (sandbox)</CardTitle>
        </CardHeader>
        <CardContent className="max-w-full space-y-5 overflow-x-hidden px-4 sm:px-6">
          <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 pr-5">
            <p className="text-sm text-muted-foreground">
              Подключите платформу для конкретного бренда. Подключение сохраняется отдельно для каждого пользователя и бренда.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Текущий статус для выбранных значений: {isSelectedConnected ? 'Подключено' : 'Не подключено'}.
            </p>
          </div>

          <div className="grid max-w-full gap-4">
            <div className="min-w-0 space-y-2 pr-1">
              <p className="text-sm font-medium">Платформа</p>
              <Select value={platform} onValueChange={(value) => setPlatform(value as Platform)}>
                <SelectTrigger className="h-11 w-full">
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
            </div>

            <div className="min-w-0 space-y-2 pr-1">
              <p className="text-sm font-medium">Бренд</p>
              <Select value={brandId} onValueChange={setBrandId}>
                <SelectTrigger className="h-11 w-full">
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
            </div>
          </div>

          <div className="grid max-w-full gap-4">
            <div className="min-w-0 space-y-2 pr-1">
              <p className="text-sm font-medium">Access token</p>
              <Input
                placeholder={isSelectedConnected ? 'Токен уже сохранен. Введите только если хотите заменить.' : 'Введите access token'}
                value={accessToken}
                onChange={(event) => setAccessToken(event.target.value)}
                className="h-11 w-full max-w-full"
              />
              {isSelectedConnected ? <p className="text-xs text-muted-foreground">Для этой связки бренд+платформа токен уже сохранен и подгружается автоматически.</p> : null}
              <p className="text-xs text-muted-foreground">
                {guideInfo
                  ? guideInfo.access
                  : 'Вставьте токен доступа платформы (ключ API/OAuth), который разрешает публикацию от вашего имени.'}
              </p>
            </div>
            <div className="min-w-0 space-y-2 pr-1">
              <p className="text-sm font-medium">Refresh token (опционально)</p>
              <Input
                placeholder="Введите refresh token"
                value={refreshToken}
                onChange={(event) => setRefreshToken(event.target.value)}
                className="h-11 w-full max-w-full"
              />
              <p className="text-xs text-muted-foreground">
                {guideInfo
                  ? guideInfo.refresh
                  : 'Заполняйте только если платформа выдала refresh token в OAuth-потоке. Иначе оставьте пустым.'}
              </p>
            </div>
          </div>

          {platform === 'TELEGRAM' ? (
            <div className="grid max-w-full gap-2">
              <p className="text-sm font-medium">Telegram chat_id или @channel_username</p>
              <Input
                placeholder="Например: -1001234567890 или @my_channel"
                value={effectiveTelegramChatId}
                onChange={(event) => setTelegramChatId(event.target.value)}
                className="h-11 w-full max-w-full"
              />
              <p className="text-xs text-muted-foreground">
                Обязательно для реальной публикации: сюда укажите канал, куда бот будет отправлять посты.
              </p>
            </div>
          ) : null}

          <div className="grid max-w-full gap-3">
            <p className="pr-1 text-xs leading-relaxed text-muted-foreground">
              Sandbox-режим: можно использовать тестовые токены для проверки потока.
            </p>
            <Button onClick={connect} disabled={isConnecting} className="h-11 w-full pr-1">
              {isConnecting ? 'Подключаем...' : 'Подключить платформу'}
            </Button>
            {lastConnectedKey === selectedKey ? (
              <p className="text-xs text-green-600">Изменения сохранены: подключение для выбранного бренда и платформы обновлено.</p>
            ) : null}
          </div>

          {platform === 'VK' ? (
            <div className="rounded-xl border border-border/70 bg-background p-3">
              <Button variant="outline" asChild>
                <a href={`/api/platform-credentials/vk/connect?brandId=${encodeURIComponent(brandId)}`}>Подключить VK через OAuth</a>
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Как подключить платформу: инструкция для пользователя</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
            <p className="font-medium">Что такое Access token?</p>
            <p className="mt-1 text-muted-foreground">
              Access token — это &quot;ключ доступа&quot;, который разрешает нашему сервису публиковать контент в выбранной платформе от вашего имени.
              Это не пароль от аккаунта. Токен можно в любой момент отозвать в кабинете платформы.
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
            <p className="font-medium">Что такое Refresh token (опционально)?</p>
            <p className="mt-1 text-muted-foreground">
              Refresh token нужен, чтобы автоматически получать новый Access token, когда старый истечет. Если платформа его не выдает —
              оставьте поле пустым.
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background p-4">
            <p className="font-medium">Инструкция для выбранной платформы: {platform}</p>
            {guideInfo ? (
              <>
                <p className="mt-2 text-muted-foreground">
                  <span className="font-medium text-foreground">Access token:</span> {guideInfo.access}
                </p>
                <p className="mt-2 text-muted-foreground">
                  <span className="font-medium text-foreground">Refresh token:</span> {guideInfo.refresh}
                </p>
                <p className="mt-2 text-muted-foreground">
                  <span className="font-medium text-foreground">Как лучше подключать:</span> {guideInfo.bestWay}
                </p>
                <ol className="mt-3 list-decimal space-y-1 pl-5 text-muted-foreground">
                  {guideInfo.steps.map((step: string) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </>
            ) : (
              <p className="mt-2 text-muted-foreground">
                Для этой платформы используйте OAuth или developer-кабинет платформы: получите Access token (и при наличии Refresh token),
                затем вставьте их в форму выше и нажмите &quot;Подключить платформу&quot;.
              </p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            В sandbox-режиме можно использовать тестовые токены для проверки потока. Перед production подключайте реальные токены и проверьте
            права публикации у приложения/бота.
          </p>
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
