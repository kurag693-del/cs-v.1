import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TIER_CONFIGS } from '@/lib/billing/actions'
import { Badge } from '@/components/ui/badge'
import { Check, ShieldCheck } from 'lucide-react'

type PricingPlan = {
  key: 'FREE' | 'PRO' | 'CREATOR' | 'AGENCY'
  title: string
  subtitle: string
  priceUSD: number
  credits: number
  features: string[]
  highlighted?: boolean
}

const pricingPlans: PricingPlan[] = [
  {
    key: 'FREE',
    title: 'Free',
    subtitle: 'Для старта и теста workflow',
    priceUSD: TIER_CONFIGS.FREE.priceUSD,
    credits: TIER_CONFIGS.FREE.monthlyCredits,
    features: ['Core AI tools', '1 бренд', 'Базовая поддержка'],
  },
  {
    key: 'PRO',
    title: 'Pro',
    subtitle: 'Стабильный ритм публикаций',
    priceUSD: TIER_CONFIGS.PRO.priceUSD,
    credits: TIER_CONFIGS.PRO.monthlyCredits,
    features: ['Приоритет генерации', '5 брендов', 'Расширенная аналитика'],
  },
  {
    key: 'CREATOR',
    title: 'Creator',
    subtitle: 'Для creators и экспертных команд',
    priceUSD: 49,
    credits: 4000,
    features: ['Продвинутые модели', 'Контент-календарь pro', 'Priority support'],
    highlighted: true,
  },
  {
    key: 'AGENCY',
    title: 'Agency',
    subtitle: 'Для агентств и multi-brand операций',
    priceUSD: TIER_CONFIGS.ENTERPRISE.priceUSD,
    credits: TIER_CONFIGS.ENTERPRISE.monthlyCredits,
    features: ['Unlimited brands', 'Shared workspace', 'SLA support'],
  },
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="mx-auto max-w-[94rem] space-y-6 md:space-y-8">
        <div className="space-y-3">
          <Badge variant="secondary" className="w-fit">
            Premium Subscription
          </Badge>
          <div>
            <h1 className="text-3xl font-bold tracking-[-0.02em]">Pricing</h1>
            <p className="mt-1.5 max-w-2xl text-[0.9375rem] text-muted-foreground">
              Прозрачные тарифы без агрессивного upsell. Выберите ритм работы, который подходит вашему контент-процессу.
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          {pricingPlans.map((plan) => (
            <Card key={plan.key} className={plan.highlighted ? 'border-primary/40 shadow-[var(--shadow-md)]' : ''}>
              <CardHeader className="space-y-3">
                {plan.highlighted ? <Badge className="w-fit">Most chosen</Badge> : null}
                <div>
                  <CardTitle>{plan.title}</CardTitle>
                  <CardDescription className="mt-1">{plan.subtitle}</CardDescription>
                </div>
                <div>
                  <p className="text-3xl font-semibold tracking-[-0.03em]">${plan.priceUSD}</p>
                  <p className="text-[0.8125rem] text-muted-foreground">per month</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-border bg-secondary p-3">
                  <p className="text-[0.75rem] uppercase tracking-[0.08em] text-muted-foreground">Monthly credits</p>
                  <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">{plan.credits.toLocaleString()}</p>
                </div>
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="inline-flex items-center gap-2 text-[0.875rem] text-muted-foreground">
                      <Check className="h-3.5 w-3.5 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button className="w-full" variant={plan.key === 'FREE' ? 'outline' : 'default'}>
                  {plan.key === 'FREE' ? 'Current tier' : 'Choose plan'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="inline-flex items-center gap-2 text-[0.9375rem] font-medium">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Trust-first billing
              </p>
              <p className="text-[0.875rem] text-muted-foreground">
                Прозрачное списание, контроль лимитов и спокойное управление подпиской.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
