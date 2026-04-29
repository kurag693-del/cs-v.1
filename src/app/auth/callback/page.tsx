'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [message, setMessage] = useState('Подтверждение завершено. Перенаправляем на вход...')

  useEffect(() => {
    const timeout = setTimeout(() => {
      router.replace('/login')
    }, 800)
    return () => clearTimeout(timeout)
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Подтверждение аккаунта</CardTitle>
          <CardDescription>Завершаем вход через ссылку из письма</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{message}</p>
        </CardContent>
      </Card>
    </div>
  )
}
