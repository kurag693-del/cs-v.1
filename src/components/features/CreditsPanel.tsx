'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AlertCircle, CreditCard, PlusCircle, RefreshCw, AlertTriangle } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { checkCredits, getSubscriptionStatus, TIER_CONFIGS } from '@/lib/billing/actions'
import { format } from 'date-fns'

interface Transaction {
  id: string
  amount: number
  type: 'credit' | 'debit'
  description: string
  createdAt: string
}

interface CreditsPanelProps {
  userId: string
}

export function CreditsPanel({ userId }: CreditsPanelProps) {
  const [credits, setCredits] = useState<number>(0)
  const [limit, setLimit] = useState<number>(100)
  const [tier, setTier] = useState<'FREE' | 'PRO' | 'ENTERPRISE'>('FREE')
  const [status, setStatus] = useState<'ACTIVE' | 'CANCELED' | 'EXPIRED' | 'TRIALING'>('ACTIVE')
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchCredits()
    fetchTransactions()
  }, [userId])

  const fetchCredits = async () => {
    try {
      const result = await checkCredits(userId)
      setCredits(result.available)
      setLimit(result.monthlyLimit)
      setTier(result.tier)

      const subStatus = await getSubscriptionStatus(userId)
      setStatus(subStatus.status)
    } catch (err) {
      console.error('Failed to fetch credits:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchTransactions = async () => {
    try {
      const res = await fetch(`/api/transactions?userId=${userId}`)
      const data = await res.json()
      if (data.success) {
        setTransactions(data.data.slice(0, 10))
      }
    } catch (err) {
      console.error('Failed to fetch transactions:', err)
    }
  }

  const handlePurchase = async (tierKey: 'PRO' | 'ENTERPRISE') => {
    const config = TIER_CONFIGS[tierKey]
    // In production: redirect to Stripe Checkout
    toast({
      title: 'Redirecting to checkout...',
      description: `${tierKey} plan - $${config.priceUSD}/month`,
    })

    // Simulate successful purchase
    // In production: Stripe redirects back to success URL
    setTimeout(() => {
      fetchCredits()
      fetchTransactions()
    }, 100)
  }

  const percentage = limit > 0 ? Math.min((credits / limit) * 100, 100) : 0
  const isLowCredits = credits < limit * 0.2
  const isOutOfCredits = credits === 0

  const usageConfig = {
    FREE: { color: 'bg-gray-500', bgColor: 'bg-gray-100' },
    PRO: { color: 'bg-blue-500', bgColor: 'bg-blue-100' },
    ENTERPRISE: { color: 'bg-purple-500', bgColor: 'bg-purple-100' },
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="h-4 bg-muted rounded w-32"></div>
            <div className="h-8 bg-muted rounded w-full"></div>
            <div className="h-4 bg-muted rounded w-24"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Credits
            </CardTitle>
            <CardDescription>
              Текущий тариф:{' '}
              <Badge variant={tier === 'ENTERPRISE' ? 'default' : tier === 'PRO' ? 'secondary' : 'outline'}>
                {tier}
              </Badge>
              {status !== 'ACTIVE' && (
                <Badge variant="destructive" className="ml-2">
                  {status}
                </Badge>
              )}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              fetchCredits()
              fetchTransactions()
              toast({ title: 'Обновлено', description: 'Данные обновлены' })
            }}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Credit Balance */}
        <div className="text-center pb-4">
          <div className="text-5xl font-bold mb-2" style={{ color: isOutOfCredits ? '#ef4444' : 'inherit' }}>
            {credits}
            <span className="text-2xl text-muted-foreground"> / {limit}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Осталось генераций
          </p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Использовано</span>
            <span className="font-medium">{Math.round(percentage)}%</span>
          </div>
          <Progress
            value={percentage}
            className={`h-2 ${
              isOutOfCredits
                ? 'bg-red-500'
                : isLowCredits
                ? 'bg-orange-500'
                : 'bg-primary'
            }`}
          />
        </div>

        {/* Alerts */}
        {isOutOfCredits && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
            <div className="text-sm text-destructive">
              <p className="font-medium">Недостаточно кредитов</p>
              <p>Пополните баланс для продолжения генерации контента.</p>
            </div>
          </div>
        )}

        {isLowCredits && !isOutOfCredits && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-yellow-50 border border-yellow-200">
            <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
            <div className="text-sm text-yellow-700">
              <p className="font-medium">Мало кредитов</p>
              <p>Осталось менее 20% от месячного лимита.</p>
            </div>
          </div>
        )}

        {status === 'EXPIRED' && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 border border-red-200">
            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
            <div className="text-sm text-red-700">
              <p className="font-medium">Подписка истекла</p>
              <p>Оплатите счет для восстановления доступа.</p>
            </div>
          </div>
        )}

        {/* Upgrade Buttons */}
        {tier !== 'ENTERPRISE' && (
          <div className="space-y-2">
            <Button
              className="w-full"
              variant={tier === 'PRO' ? 'outline' : 'default'}
              onClick={() => handlePurchase('PRO')}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              PRO — ${TIER_CONFIGS.PRO.priceUSD}/месяц
              <span className="ml-2 text-xs opacity-70">({TIER_CONFIGS.PRO.monthlyCredits} кредитов)</span>
            </Button>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => handlePurchase('ENTERPRISE')}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              ENTERPRISE — ${TIER_CONFIGS.ENTERPRISE.priceUSD}/месяц
              <span className="ml-2 text-xs opacity-70">({TIER_CONFIGS.ENTERPRISE.monthlyCredits} кредитов)</span>
            </Button>
          </div>
        )}

        {/* Transaction History Toggle */}
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between"
            onClick={() => setShowHistory(!showHistory)}
          >
            <span className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              История транзакций
            </span>
            <span className="text-xs text-muted-foreground">
              {showHistory ? 'Скрыть' : 'Показать'}
            </span>
          </Button>

          {showHistory && (
            <div className="mt-4 rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Сумма</TableHead>
                    <TableHead>Описание</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        Нет транзакций
                      </TableCell>
                    </TableRow>
                  ) : (
                    transactions.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="text-sm">
                          {format(new Date(t.createdAt), 'dd.MM HH:mm')}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`font-medium ${
                              t.type === 'credit' ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {t.type === 'credit' ? '+' : '-'}{Math.abs(t.amount)}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {t.description}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
