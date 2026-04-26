import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TIER_CONFIGS } from '@/lib/billing/actions'

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Тарифы</h1>
          <p className="text-muted-foreground">MVP модель монетизации: только подписка.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {Object.entries(TIER_CONFIGS).map(([tier, config]) => (
            <Card key={tier}>
              <CardHeader>
                <CardTitle>{tier}</CardTitle>
                <CardDescription>${config.priceUSD}/month</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="font-medium">{config.monthlyCredits} credits/month</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {config.features.map((feature) => (
                    <li key={feature}>- {feature}</li>
                  ))}
                </ul>
                <Button className="w-full" variant={tier === 'FREE' ? 'outline' : 'default'}>
                  {tier === 'FREE' ? 'Current tier' : 'Choose plan'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <Button asChild variant="outline">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  )
}
