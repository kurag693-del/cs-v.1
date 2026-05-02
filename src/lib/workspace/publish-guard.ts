import type { WorkspaceMemberRole } from '@prisma/client'

import { prisma } from '@/lib/db'
import { getEditorsCanPublishFromSettings } from '@/lib/workspace/workspace-settings'

export type PublishGateResult = { ok: true } | { ok: false; code: string; message: string }

/** Только для текущей модели: пост принадлежит автору действия. */
export async function assertUserCanScheduleOrPublishPost(params: {
  actorUserId: string
  post: { userId: string; brandId: string | null }
}): Promise<PublishGateResult> {
  const { actorUserId, post } = params
  if (actorUserId !== post.userId) {
    return {
      ok: false,
      code: 'FORBIDDEN',
      message: 'Планирование и публикация доступны только автору поста',
    }
  }

  if (!post.brandId) {
    return { ok: true }
  }

  const brand = await prisma.brand.findFirst({
    where: { id: post.brandId, deletedAt: null },
    select: { userId: true, workspaceId: true },
  })
  if (!brand) {
    return { ok: false, code: 'NOT_FOUND', message: 'Бренд не найден' }
  }

  if (!brand.workspaceId) {
    if (brand.userId !== actorUserId) {
      return {
        ok: false,
        code: 'FORBIDDEN',
        message: 'Публикация в каналы доступна только владельцу бренда',
      }
    }
    return { ok: true }
  }

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: brand.workspaceId, userId: actorUserId } },
    select: { role: true },
  })
  if (!member) {
    return { ok: false, code: 'FORBIDDEN', message: 'Нет доступа к пространству бренда' }
  }

  return roleAllowsChannelPublish(member.role, brand.workspaceId, actorUserId)
}

async function roleAllowsChannelPublish(
  role: WorkspaceMemberRole,
  workspaceId: string,
  actorUserId: string
): Promise<PublishGateResult> {
  if (role === 'VIEWER') {
    return {
      ok: false,
      code: 'FORBIDDEN',
      message: 'Роль «Наблюдатель» не может планировать и публиковать посты в каналы',
    }
  }

  const ws = await prisma.workspace.findFirst({
    where: { id: workspaceId, deletedAt: null },
    select: { settings: true, ownerId: true },
  })
  if (!ws) {
    return { ok: false, code: 'NOT_FOUND', message: 'Пространство не найдено' }
  }

  const editorsCan = getEditorsCanPublishFromSettings(ws.settings)

  if (role === 'EDITOR' && !editorsCan) {
    return {
      ok: false,
      code: 'EDITOR_PUBLISH_DISABLED',
      message:
        'Редакторы в этом пространстве не могут планировать и публиковать в каналы. Попросите владельца или администратора включить опцию в настройках команды либо выполните публикацию под ролью администратора.',
    }
  }

  return { ok: true }
}
