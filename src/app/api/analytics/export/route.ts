import { fail } from '@/lib/api/response'
import { validateSession } from '@/lib/auth/lucia'
import { prisma } from '@/lib/db'
import { AnalyticsExportSchema, toCsv, type ExportRow } from '@/lib/analytics/export'

function iso(value: Date | null): string {
  return value ? value.toISOString() : ''
}

export async function GET(request: Request) {
  const { user } = await validateSession()
  if (!user?.id) {
    return fail('Unauthorized', 401, 'UNAUTHORIZED')
  }

  const url = new URL(request.url)
  const parsed = AnalyticsExportSchema.safeParse({
    format: url.searchParams.get('format') ?? undefined,
    from: url.searchParams.get('from') ?? undefined,
    to: url.searchParams.get('to') ?? undefined,
    platform: url.searchParams.get('platform') ?? undefined,
  })
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Invalid export params', 400, 'INVALID_EXPORT_PARAMS')
  }

  const from = parsed.data.from ? new Date(parsed.data.from) : undefined
  const to = parsed.data.to ? new Date(parsed.data.to) : undefined

  const posts = await prisma.post.findMany({
    where: {
      userId: user.id,
      deletedAt: null,
      platform: parsed.data.platform,
      ...(from || to
        ? {
            createdAt: {
              gte: from,
              lte: to,
            },
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      platform: true,
      status: true,
      scheduledAt: true,
      publishedAt: true,
      createdAt: true,
    },
  })

  const rows: ExportRow[] = posts.map((post) => ({
    id: post.id,
    platform: post.platform,
    status: post.status,
    scheduledAt: iso(post.scheduledAt),
    publishedAt: iso(post.publishedAt),
    createdAt: post.createdAt.toISOString(),
  }))

  if (parsed.data.format === 'json') {
    return new Response(JSON.stringify({ success: true, data: rows }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="analytics-export.json"',
      },
    })
  }

  const csv = toCsv(rows)
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="analytics-export.csv"',
    },
  })
}
