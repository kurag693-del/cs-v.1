import type { WorkspaceMember, WorkspaceMemberRole } from '@prisma/client'

const RANK: Record<WorkspaceMemberRole, number> = {
  VIEWER: 1,
  EDITOR: 2,
  ADMIN: 3,
  OWNER: 4,
}

export function roleRank(role: WorkspaceMemberRole): number {
  return RANK[role]
}

export function isOwner(role: WorkspaceMemberRole): boolean {
  return role === 'OWNER'
}

export function isAdminLike(member: WorkspaceMember): boolean {
  if (member.role === 'OWNER') return true
  if (member.role === 'ADMIN' && member.delegateFullAccess) return true
  return false
}

/** Приглашать могут владелец и админы (без необходимости delegateFullAccess). */
export function canInviteMembers(role: WorkspaceMemberRole): boolean {
  return role === 'OWNER' || role === 'ADMIN'
}

export function canManageMembers(actorRole: WorkspaceMemberRole): boolean {
  return actorRole === 'OWNER' || actorRole === 'ADMIN'
}

/** Настройки делегирования для ADMIN — только OWNER. */
export function canEditAdminDelegates(actorRole: WorkspaceMemberRole): boolean {
  return actorRole === 'OWNER'
}

export function canRemoveMember(actor: WorkspaceMember, targetRole: WorkspaceMemberRole): boolean {
  return canRemoveMemberRow(actor.role, actor.delegateFullAccess, targetRole)
}

/** Для UI без полного объекта Prisma. */
export function canRemoveMemberRow(
  actorRole: WorkspaceMemberRole,
  actorDelegateFullAccess: boolean,
  targetRole: WorkspaceMemberRole
): boolean {
  if (targetRole === 'OWNER') return false
  if (actorRole === 'OWNER') return true
  if (actorRole === 'ADMIN') {
    if (actorDelegateFullAccess) {
      return targetRole === 'ADMIN' || targetRole === 'EDITOR' || targetRole === 'VIEWER'
    }
    return targetRole === 'EDITOR' || targetRole === 'VIEWER'
  }
  return false
}

export function canCreateBrand(role: WorkspaceMemberRole): boolean {
  return RANK[role] >= RANK.EDITOR
}
