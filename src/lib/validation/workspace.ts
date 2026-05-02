import { z } from 'zod'

export const workspaceInviteRoleSchema = z.enum(['ADMIN', 'EDITOR', 'VIEWER'])

export const inviteMemberInputSchema = z.object({
  workspaceId: z.string().min(1),
  email: z.string().email('Некорректный email').max(320),
  role: workspaceInviteRoleSchema,
})

export const acceptInviteInputSchema = z.object({
  token: z.string().min(20).max(512),
})

export const updateAdminDelegatesSchema = z.object({
  workspaceId: z.string().min(1),
  targetUserId: z.string().min(1),
  delegateBilling: z.boolean(),
  delegateFullAccess: z.boolean(),
})

export const updateWorkspacePublishPolicySchema = z.object({
  workspaceId: z.string().min(1),
  editorsCanPublish: z.boolean(),
})

export type InviteMemberInput = z.infer<typeof inviteMemberInputSchema>
