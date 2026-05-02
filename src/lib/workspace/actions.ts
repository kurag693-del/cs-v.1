'use server'

import { Prisma, WorkspaceInviteRole, WorkspaceMemberRole } from '@prisma/client'
import { revalidatePath } from 'next/cache'

import { validateSession } from '@/lib/auth/lucia'
import { prisma } from '@/lib/db'
import { generateInviteSecret, hashInviteToken } from '@/lib/workspace/invite-token'
import { canEditAdminDelegates, canInviteMembers, canManageMembers, canRemoveMember } from '@/lib/workspace/permissions'
import { getEditorsCanPublishFromSettings, mergeWorkspaceSettings } from '@/lib/workspace/workspace-settings'
import {
  acceptInviteInputSchema,
  inviteMemberInputSchema,
  updateAdminDelegatesSchema,
  updateWorkspacePublishPolicySchema,
} from '@/lib/validation/workspace'

const INVITE_TTL_MS = 48 * 60 * 60 * 1000
const MAX_INVITES_PER_WORKSPACE_PER_DAY = 30
const MAX_INVITES_PER_ACTOR_PER_HOUR = 15

export type WorkspaceSummary = {
  id: string
  name: string
  role: WorkspaceMemberRole
  isOwner: boolean
}

export async function listMyWorkspaces(): Promise<
  { success: true; workspaces: WorkspaceSummary[] } | { success: false; error: string }
> {
  const { user } = await validateSession()
  if (!user) return { success: false, error: 'Не авторизован' }

  const rows = await prisma.workspaceMember.findMany({
    where: { userId: user.id },
    include: { workspace: { select: { id: true, name: true, ownerId: true, deletedAt: true } } },
  })

  const workspaces = rows
    .filter((r) => r.workspace.deletedAt == null)
    .map((r) => ({
      id: r.workspace.id,
      name: r.workspace.name,
      role: r.role,
      isOwner: r.workspace.ownerId === user.id,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))

  return { success: true, workspaces }
}

/** Личное пространство: первое владение или создание. Используется при создании бренда и миграции. */
export async function ensurePersonalWorkspace(userId: string): Promise<string> {
  const existing = await prisma.workspaceMember.findFirst({
    where: {
      userId,
      role: WorkspaceMemberRole.OWNER,
    },
    select: { workspaceId: true },
  })
  if (existing) return existing.workspaceId

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  })

  const ws = await prisma.workspace.create({
    data: {
      name: user?.name?.trim() || 'Моё пространство',
      ownerId: userId,
      /** Новые пространства: редакторы не публикуют без явного разрешения владельца/админа. */
      settings: { editorsCanPublish: false } as Prisma.InputJsonValue,
      members: {
        create: {
          userId,
          role: WorkspaceMemberRole.OWNER,
        },
      },
    },
  })

  await prisma.brand.updateMany({
    where: { userId, workspaceId: null, deletedAt: null },
    data: { workspaceId: ws.id },
  })

  return ws.id
}

function inviteRoleToMemberRole(role: WorkspaceInviteRole): WorkspaceMemberRole {
  switch (role) {
    case WorkspaceInviteRole.ADMIN:
      return WorkspaceMemberRole.ADMIN
    case WorkspaceInviteRole.EDITOR:
      return WorkspaceMemberRole.EDITOR
    case WorkspaceInviteRole.VIEWER:
      return WorkspaceMemberRole.VIEWER
    default: {
      const _exhaustive: never = role
      return _exhaustive
    }
  }
}

function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'http://localhost:3000'
}

export async function inviteWorkspaceMember(
  input: unknown
): Promise<
  | { success: true; inviteUrl: string; expiresAt: Date }
  | { success: false; error: string; code?: string }
> {
  const parsed = inviteMemberInputSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Ошибка валидации', code: 'VALIDATION' }
  }

  const { user } = await validateSession()
  if (!user) return { success: false, error: 'Не авторизован', code: 'AUTH' }

  const { workspaceId, email, role } = parsed.data
  const emailNorm = email.trim().toLowerCase()

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
  })
  if (!member || !canInviteMembers(member.role)) {
    return { success: false, error: 'Нет прав приглашать участников', code: 'FORBIDDEN' }
  }

  const sinceDay = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const invitesToday = await prisma.workspaceInvite.count({
    where: { workspaceId, createdAt: { gte: sinceDay } },
  })
  if (invitesToday >= MAX_INVITES_PER_WORKSPACE_PER_DAY) {
    return { success: false, error: 'Достигнут лимит приглашений на пространство за сутки', code: 'RATE_LIMIT' }
  }

  const sinceHour = new Date(Date.now() - 60 * 60 * 1000)
  const myHour = await prisma.workspaceInvite.count({
    where: { createdById: user.id, createdAt: { gte: sinceHour } },
  })
  if (myHour >= MAX_INVITES_PER_ACTOR_PER_HOUR) {
    return { success: false, error: 'Слишком много приглашений за час — попробуйте позже', code: 'RATE_LIMIT' }
  }

  const existingUser = await prisma.user.findFirst({
    where: { email: { equals: emailNorm, mode: 'insensitive' }, deletedAt: null },
    select: { id: true },
  })
  if (existingUser) {
    const already = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: existingUser.id } },
    })
    if (already) {
      return { success: false, error: 'Пользователь уже в этом пространстве', code: 'DUPLICATE' }
    }
  }

  await prisma.workspaceInvite.deleteMany({
    where: {
      workspaceId,
      emailNorm,
      usedAt: null,
    },
  })

  const { rawToken, tokenHash } = generateInviteSecret()
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS)

  const prismaInviteRole: WorkspaceInviteRole =
    role === 'ADMIN'
      ? WorkspaceInviteRole.ADMIN
      : role === 'EDITOR'
        ? WorkspaceInviteRole.EDITOR
        : WorkspaceInviteRole.VIEWER

  await prisma.workspaceInvite.create({
    data: {
      workspaceId,
      email,
      emailNorm,
      role: prismaInviteRole,
      tokenHash,
      expiresAt,
      createdById: user.id,
    },
  })

  const inviteUrl = `${appBaseUrl()}/join/workspace?t=${encodeURIComponent(rawToken)}`
  revalidatePath('/dashboard/workspace')
  return { success: true, inviteUrl, expiresAt }
}

export async function acceptWorkspaceInvite(
  input: unknown
): Promise<{ success: true } | { success: false; error: string; code?: string }> {
  const parsed = acceptInviteInputSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Некорректная ссылка', code: 'VALIDATION' }
  }

  const { user } = await validateSession()
  if (!user) return { success: false, error: 'Войдите в аккаунт, чтобы принять приглашение', code: 'AUTH' }

  const tokenHash = hashInviteToken(parsed.data.token)

  const invite = await prisma.workspaceInvite.findUnique({
    where: { tokenHash },
    include: { workspace: true },
  })

  if (!invite || invite.workspace.deletedAt) {
    return { success: false, error: 'Приглашение не найдено или пространство удалено', code: 'NOT_FOUND' }
  }
  if (invite.usedAt) {
    return { success: false, error: 'Ссылка уже использована', code: 'USED' }
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    return { success: false, error: 'Срок действия ссылки истёк', code: 'EXPIRED' }
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true },
  })
  const userEmail = dbUser?.email?.trim().toLowerCase() ?? ''
  if (userEmail !== invite.emailNorm) {
    return {
      success: false,
      error: 'Войдите под email, на который отправлено приглашение',
      code: 'EMAIL_MISMATCH',
    }
  }

  const memberRole = inviteRoleToMemberRole(invite.role)

  await prisma.$transaction([
    prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId: user.id } },
      create: {
        workspaceId: invite.workspaceId,
        userId: user.id,
        role: memberRole,
      },
      update: {
        role: memberRole,
      },
    }),
    prisma.workspaceInvite.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    }),
  ])

  revalidatePath('/dashboard/workspace')
  revalidatePath('/dashboard/brands')
  return { success: true }
}

export type MemberRow = {
  userId: string
  email: string
  name: string | null
  role: WorkspaceMemberRole
  delegateBilling: boolean
  delegateFullAccess: boolean
}

export async function listWorkspaceMembers(workspaceId: string): Promise<
  { success: true; members: MemberRow[]; actorRole: WorkspaceMemberRole | null } | { success: false; error: string }
> {
  const { user } = await validateSession()
  if (!user) return { success: false, error: 'Не авторизован' }

  const actor = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
  })
  if (!actor) return { success: false, error: 'Нет доступа к пространству' }

  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: { user: { select: { email: true, name: true } } },
    orderBy: { role: 'desc' },
  })

  const rows: MemberRow[] = members.map((m) => ({
    userId: m.userId,
    email: m.user.email,
    name: m.user.name,
    role: m.role,
    delegateBilling: m.delegateBilling,
    delegateFullAccess: m.delegateFullAccess,
  }))

  return { success: true, members: rows, actorRole: actor.role }
}

export async function removeWorkspaceMember(
  workspaceId: string,
  targetUserId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const { user } = await validateSession()
  if (!user) return { success: false, error: 'Не авторизован' }

  const actor = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
  })
  const target = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
  })
  if (!actor || !target) return { success: false, error: 'Участник не найден' }
  if (!canRemoveMember(actor, target.role)) {
    return { success: false, error: 'Недостаточно прав' }
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerId: true },
  })
  if (workspace?.ownerId === targetUserId) {
    return { success: false, error: 'Нельзя удалить владельца пространства' }
  }

  await prisma.workspaceMember.delete({
    where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
  })

  revalidatePath('/dashboard/workspace')
  return { success: true }
}

export async function updateWorkspaceAdminDelegates(
  input: unknown
): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = updateAdminDelegatesSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Ошибка валидации' }
  }

  const { user } = await validateSession()
  if (!user) return { success: false, error: 'Не авторизован' }

  const { workspaceId, targetUserId, delegateBilling, delegateFullAccess } = parsed.data

  const actor = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
  })
  if (!actor || !canEditAdminDelegates(actor.role)) {
    return { success: false, error: 'Только владелец может менять делегирование' }
  }

  const target = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
  })
  if (!target || target.role !== WorkspaceMemberRole.ADMIN) {
    return { success: false, error: 'Делегирование задаётся только для администраторов' }
  }

  await prisma.workspaceMember.update({
    where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    data: { delegateBilling, delegateFullAccess },
  })

  revalidatePath('/dashboard/workspace')
  return { success: true }
}

export async function getWorkspaceAccessSnapshot(userId: string, workspaceId: string) {
  const m = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  })
  return m
}

export async function getWorkspacePublishFlags(workspaceId: string): Promise<
  { success: true; editorsCanPublish: boolean } | { success: false; error: string }
> {
  const { user } = await validateSession()
  if (!user) return { success: false, error: 'Не авторизован' }

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
  })
  if (!member) return { success: false, error: 'Нет доступа к пространству' }

  const ws = await prisma.workspace.findFirst({
    where: { id: workspaceId, deletedAt: null },
    select: { settings: true },
  })
  if (!ws) return { success: false, error: 'Пространство не найдено' }

  return { success: true, editorsCanPublish: getEditorsCanPublishFromSettings(ws.settings) }
}

export async function updateWorkspacePublishPolicy(
  input: unknown
): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = updateWorkspacePublishPolicySchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Ошибка валидации' }
  }

  const { user } = await validateSession()
  if (!user) return { success: false, error: 'Не авторизован' }

  const { workspaceId, editorsCanPublish } = parsed.data

  const actor = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
  })
  if (!actor || !canManageMembers(actor.role)) {
    return { success: false, error: 'Только владелец или администратор может менять политику публикации' }
  }

  const ws = await prisma.workspace.findFirst({
    where: { id: workspaceId, deletedAt: null },
    select: { settings: true },
  })
  if (!ws) return { success: false, error: 'Пространство не найдено' }

  const nextSettings = mergeWorkspaceSettings(ws.settings, { editorsCanPublish })

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { settings: nextSettings as Prisma.InputJsonValue },
  })

  revalidatePath('/dashboard/workspace')
  return { success: true }
}
