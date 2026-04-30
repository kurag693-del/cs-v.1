import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CheckCircle2, Circle, Sparkles } from 'lucide-react'

import { validateSession } from '@/lib/auth/lucia'
import { getOnboardingProgress } from '@/lib/onboarding/actions'
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
      <Card className="border-primary/20">
        <CardHeader>
          <Badge variant="secondary" className="w-fit">
            Быстрый старт
          </Badge>
          <CardTitle className="mt-2">Онбординг Креатив-студии</CardTitle>
          <CardDescription>
            Пройдите 3 шага до первой полноценной публикации. Прогресс сохраняется автоматически.
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
            После онбординга
          </CardTitle>
          <CardDescription>
            Перейдите в календарь, поставьте расписание и запустите очередь публикаций.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/dashboard/calendar">Открыть календарь</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
