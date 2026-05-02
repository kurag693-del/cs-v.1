'use server'

import { Prisma } from '@prisma/client'

import { z } from 'zod'

import { validateSession } from '@/lib/auth/lucia'
import { prisma } from '@/lib/db'
import { parseUserTemplatePayload, type UserTemplatePayload, userTemplatePayloadSchema } from '@/lib/templates/user-template-payload'
import { listMyWorkspaces, type WorkspaceSummary } from '@/lib/workspace/actions'
import { canCreateBrand } from '@/lib/workspace/permissions'

const createInputSchema = z.object({
  name: z.string().min(1).max(120),
  workspaceId: z.union([z.string().min(1), z.null()]).optional(),
  payload: z.record(z.string(), z.unknown()),
})

async function getWorkspaceRole(userId: string, workspaceId: string): Promise<WorkspaceSummary['role'] | null> {
  const m = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true },
  })
  return m?.role ?? null
}

export type UserContentTemplateRow = {
  id: string
  name: string
  workspaceId: string | null
  createdById: string
  payload: UserTemplatePayload
  updatedAt: Date
}

export async function listUserContentTemplates(): Promise<
  | { success: true; templates: UserContentTemplateRow[] }
  | { success: false; error: string }
> {
  const { user } = await validateSession()
  if (!user) return { success: false, error: 'Не авторизован' }

  const wsResult = await listMyWorkspaces()
  const workspaceIds = wsResult.success ? new Set(wsResult.workspaces.map((w) => w.id)) : new Set<string>()

  const own = await prisma.userContentTemplate.findMany({
    where: { createdById: user.id, deletedAt: null },
    orderBy: { updatedAt: 'desc' },
  })

  const team =
    workspaceIds.size === 0
      ? []
      : await prisma.userContentTemplate.findMany({
          where: {
            deletedAt: null,
            workspaceId: { in: [...workspaceIds] },
            NOT: { createdById: user.id },
          },
          orderBy: { updatedAt: 'desc' },
        })

  const mapRow = (r: (typeof own)[0]): UserContentTemplateRow | null => {
    try {
      const payload = parseUserTemplatePayload(r.payload)
      return {
        id: r.id,
        name: r.name,
        workspaceId: r.workspaceId,
        createdById: r.createdById,
        payload,
        updatedAt: r.updatedAt,
      }
    } catch {
      return null
    }
  }

  const merged = [...own, ...team]
  const seen = new Set<string>()
  const out: UserContentTemplateRow[] = []
  for (const r of merged) {
    if (seen.has(r.id)) continue
    seen.add(r.id)
    const row = mapRow(r)
    if (row) out.push(row)
  }
  out.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())

  return { success: true, templates: out }
}

export async function createUserContentTemplate(
  input: unknown
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const parsed = createInputSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Некорректные данные' }
  }

  const { user } = await validateSession()
  if (!user) return { success: false, error: 'Не авторизован' }

  let payloadParsed: UserTemplatePayload
  try {
    payloadParsed = userTemplatePayloadSchema.parse(parsed.data.payload)
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Некорректное тело шаблона' }
  }

  const wsId = parsed.data.workspaceId ?? null
  if (wsId) {
    const role = await getWorkspaceRole(user.id, wsId)
    if (!role) return { success: false, error: 'Нет доступа к пространству' }
    if (!canCreateBrand(role)) return { success: false, error: 'Недостаточно прав для сохранения командного шаблона' }
  }

  const row = await prisma.userContentTemplate.create({
    data: {
      name: parsed.data.name.trim(),
      workspaceId: wsId,
      createdById: user.id,
      payload: payloadParsed as unknown as Prisma.InputJsonValue,
    },
  })

  return { success: true, id: row.id }
}

export async function deleteUserContentTemplate(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  const { user } = await validateSession()
  if (!user) return { success: false, error: 'Не авторизован' }

  const row = await prisma.userContentTemplate.findFirst({
    where: { id, deletedAt: null },
  })
  if (!row) return { success: false, error: 'Шаблон не найден' }

  if (row.createdById === user.id) {
    await prisma.userContentTemplate.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
    return { success: true }
  }

  if (row.workspaceId) {
    const role = await getWorkspaceRole(user.id, row.workspaceId)
    if (role === 'ADMIN' || role === 'OWNER') {
      await prisma.userContentTemplate.update({
        where: { id },
        data: { deletedAt: new Date() },
      })
      return { success: true }
    }
  }

  return { success: false, error: 'Нет прав на удаление' }
}

export async function getWorkspacesForTemplateCreate(): Promise<
  { success: true; workspaces: WorkspaceSummary[] } | { success: false; error: string }
> {
  return listMyWorkspaces()
}
