/**
 * Импорт пользовательских шаблонов ниш из CSV в UserContentTemplate.
 * Требуется: DATABASE_URL, существующий userId в БД, опционально workspaceId.
 *
 * Формат CSV (заголовок обязателен):
 * name,industry,defaultPrompt,category,platforms,tone,workspaceId,createdById
 * platforms — через | например Instagram|Telegram
 * category — horeca|beauty|b2b|personal|retail|fitness|education|realestate
 * workspaceId и createdById — cuid; workspaceId может быть пустым (личный шаблон)
 *
 * Запуск (из корня репозитория):
 *   node scripts/import-user-templates-csv.mjs path/to/file.csv
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { PrismaClient } from '@prisma/client'

const __dirname = dirname(fileURLToPath(import.meta.url))

function parseCsvLine(line) {
  const out = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (!inQuotes && c === ',') {
      out.push(cur.trim())
      cur = ''
      continue
    }
    cur += c
  }
  out.push(cur.trim())
  return out
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) throw new Error('CSV: нужна строка заголовка и хотя бы одна строка данных')
  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase())
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i])
    const row = {}
    header.forEach((key, j) => {
      row[key] = cells[j] ?? ''
    })
    rows.push(row)
  }
  return rows
}

const prisma = new PrismaClient()

async function main() {
  const pathArg = process.argv[2]
  if (!pathArg) {
    console.error('Usage: node scripts/import-user-templates-csv.mjs <file.csv>')
    process.exit(1)
  }
  const csvPath = resolve(process.cwd(), pathArg)
  const raw = readFileSync(csvPath, 'utf8')
  const rows = parseCsv(raw)

  for (const r of rows) {
    const name = r.name?.trim()
    const industry = r.industry?.trim() || 'Импорт CSV'
    const defaultPrompt = r.defaultprompt?.trim() || r.default_prompt?.trim()
    const category = (r.category || 'b2b').trim()
    const platformsRaw = (r.platforms || 'Instagram').split('|').map((s) => s.trim()).filter(Boolean)
    const tone = (r.tone || 'brand').trim()
    const workspaceId = r.workspaceid?.trim() || r.workspace_id?.trim() || null
    const createdById = r.createdbyid?.trim() || r.created_by_id?.trim()
    if (!name || !defaultPrompt || !createdById) {
      console.warn('Skip row (missing name, defaultPrompt or createdById):', r)
      continue
    }

    const payload = {
      industry,
      defaultPrompt,
      category,
      suggestedPlatforms: platformsRaw.length ? platformsRaw : ['Instagram'],
      tone: tone === 'humor' || tone === 'formal' || tone === 'brand' ? tone : 'brand',
      includeEmojisDefault: true,
    }

    await prisma.userContentTemplate.create({
      data: {
        name,
        workspaceId: workspaceId || null,
        createdById,
        payload,
      },
    })
    console.log('Inserted:', name)
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
