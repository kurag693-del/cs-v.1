import { z } from 'zod'
import { Platform } from '@prisma/client'

export const AnalyticsExportSchema = z.object({
  format: z.enum(['csv', 'json']).default('csv'),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  platform: z.nativeEnum(Platform).optional(),
})

export type ExportRow = {
  id: string
  platform: string
  status: string
  scheduledAt: string
  publishedAt: string
  createdAt: string
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function toCsv(rows: ExportRow[]): string {
  const header = ['id', 'platform', 'status', 'scheduledAt', 'publishedAt', 'createdAt']
  const body = rows.map((row) =>
    [row.id, row.platform, row.status, row.scheduledAt, row.publishedAt, row.createdAt].map(escapeCsv).join(',')
  )
  return [header.join(','), ...body].join('\n')
}
