'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card'
import { useRouter } from 'next/navigation'
import { ArrowRight, CalendarDays, Sparkles, Wand2 } from 'lucide-react'

export default function Home() {
  const router = useRouter()

  return (
    <main className="min-h-screen bg-background px-4 py-8 md:px-8 md:py-12">
      <section className="mx-auto max-w-[94rem] space-y-6 md:space-y-8">
        <Card className="rounded-3xl border-border bg-card">
          <CardContent className="grid gap-8 p-6 md:p-10 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-5">
              <Badge variant="secondary" className="w-fit">
                Calm Premium Intelligence
              </Badge>
              <div className="space-y-3">
                <h1 className="text-4xl font-bold tracking-[-0.03em] md:text-5xl">Креатив-студия</h1>
                <p className="max-w-2xl text-[1rem] text-muted-foreground md:text-[1.0625rem]">
                  Creator Operating System для генерации, планирования, публикации и аналитики контента в едином AI workflow.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="lg" onClick={() => router.push('/register')}>
                  Начать бесплатно
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="lg" onClick={() => router.push('/login')}>
                  Войти в аккаунт
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-secondary p-5">
              <p className="text-[0.75rem] uppercase tracking-[0.08em] text-muted-foreground">Main Workflow</p>
              <div className="mt-3 space-y-2.5">
                <div className="rounded-xl border border-border bg-card px-3 py-2.5 text-[0.9375rem]">
                  <span className="inline-flex items-center gap-2 font-medium">
                    <Wand2 className="h-4 w-4 text-primary" />
                    Создание
                  </span>
                </div>
                <div className="rounded-xl border border-border bg-card px-3 py-2.5 text-[0.9375rem]">
                  <span className="inline-flex items-center gap-2 font-medium">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    Планирование
                  </span>
                </div>
                <div className="rounded-xl border border-border bg-card px-3 py-2.5 text-[0.9375rem]">
                  <span className="inline-flex items-center gap-2 font-medium">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Публикация и аналитика
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="silent-lift">
            <CardContent className="pt-6">
              <CardTitle className="mb-2 text-xl">AI Generation</CardTitle>
              <CardDescription>Создавайте посты, хук и CTA с учетом платформы и brand voice.</CardDescription>
            </CardContent>
          </Card>
          <Card className="silent-lift">
            <CardContent className="pt-6">
              <CardTitle className="mb-2 text-xl">Smart Planning</CardTitle>
              <CardDescription>Календарь с очередью контента, статусами публикации и clean UX.</CardDescription>
            </CardContent>
          </Card>
          <Card className="silent-lift">
            <CardContent className="pt-6">
              <CardTitle className="mb-2 text-xl">Calm Analytics</CardTitle>
              <CardDescription>Минимальные, но actionable инсайты для роста охвата и вовлечения.</CardDescription>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  )
}
