import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Building2, CheckCircle2, Circle, Sparkles, Users } from 'lucide-react'

import { validateSession } from '@/lib/auth/lucia'
import { getOnboardingProgress } from '@/lib/onboarding/actions'
import { TemplateSelector } from '@/components/features/TemplateSelector'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function OnboardingPage() {
  const { user } = await validateSession()
  if (!user) {
    redirect('/login')
  }

  const progressResult = await getOnboardingProgress(user.id)
  if (!progressResult.success) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <Card>
          <CardHeader>
            <CardTitle>Онбординг временно недоступен</CardTitle>
            <CardDescription>Не удалось загрузить прогресс. Перейдите в дашборд и попробуйте позже.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/dashboard">Перейти в дашборд</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const progress = progressResult.data

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <Card className="border-muted">
        <CardHeader>
          <CardTitle className="text-base">Как устроено приложение</CardTitle>
          <CardDescription className="leading-relaxed">
            <strong>Рабочее пространство</strong> — контейнер для команды и брендов. <strong>Бренд</strong> — настройки
            голоса и тона для контента. Генерация и календарь работают в контексте выбранного бренда и пространства.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/workspace">
              <Users className="mr-2 h-4 w-4" />
              Команда и доступ
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/brands">
              <Building2 className="mr-2 h-4 w-4" />
              Бренды
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Старт с шаблона ниши</CardTitle>
          <CardDescription>
            Откройте генератор с пресетом темы, платформы и тона. Составной id шаблона вида{' '}
            <span className="font-mono text-xs">coffee-shop__new-menu-item</span> — это сценарий внутри выбранной сферы.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TemplateSelector mode="linkToGenerate" />
        </CardContent>
      </Card>

      <Card className="border-primary/20">
        <CardHeader>
          <Badge variant="secondary" className="w-fit">
            Четыре шага
          </Badge>
          <CardTitle className="mt-2">Онбординг Креатив-студии</CardTitle>
          <CardDescription>
            От бренда до публикации. Прогресс считается автоматически по данным вашего аккаунта.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Выполнено: {progress.completedSteps}/{progress.totalSteps}
          </p>
          {progress.isCompleted ? (
            <Badge>Готово</Badge>
          ) : (
            <Button asChild variant="outline">
              <Link href={progress.steps.find((step) => !step.done)?.href ?? '/dashboard'}>Продолжить</Link>
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        {progress.steps.map((step, index) => (
          <Card key={step.id}>
            <CardContent className="flex items-start justify-between gap-3 p-4">
              <div className="flex gap-3">
                <div className="mt-0.5 text-primary">
                  {step.done ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    Шаг {index + 1}. {step.title}
                  </p>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              </div>
              <Button asChild size="sm" variant={step.done ? 'secondary' : 'default'}>
                <Link href={step.href}>{step.done ? 'Открыть' : 'Сделать'}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" />
            Дальше
          </CardTitle>
          <CardDescription>
            Аналитика по вашим постам и расписанию — на дашборде и в разделе «Аналитика». Охваты из соцсетей подтягиваются
            по мере подключения API провайдеров (в развитии).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/calendar">Календарь</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/analytics">Аналитика</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
