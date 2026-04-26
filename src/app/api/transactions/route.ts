import { prisma } from '@/lib/db'
import { fail, ok } from '@/lib/api/response'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  if (!userId) {
    return fail('userId is required', 400, 'MISSING_USER_ID')
  }

  try {
    const transactions = await prisma.generation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const normalized = transactions.map((item) => ({
      id: item.id,
      amount: Number((item.metadata as { amount?: number } | null)?.amount ?? 0),
      type: ((item.metadata as { operation?: 'credit' | 'debit' } | null)?.operation ?? 'debit') as 'credit' | 'debit',
      description: item.output ?? item.prompt ?? 'Transaction',
      createdAt: item.createdAt,
    }))

    return ok(normalized)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return fail(message, 500, 'TRANSACTIONS_FETCH_FAILED')
  }
}
