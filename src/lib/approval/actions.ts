'use server'

import { prisma } from '@/lib/db'
import { validateSession } from '@/lib/auth/lucia'
import { canTransitionApprovalStatus, getApprovalStatus, setApprovalStatus, type ApprovalStatus } from '@/lib/approval/workflow'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'

async function updateApproval(postId: string, nextStatus: ApprovalStatus, note?: string) {
  const { user } = await validateSession()
  const userId = user?.id ?? null
  if (!userId) {
    return { success: false as const, error: 'Пользователь не авторизован' }
  }

  const post = await prisma.post.findFirst({
    where: {
      id: postId,
      userId,
      deletedAt: null,
    },
    select: {
      id: true,
      metadata: true,
    },
  })

  if (!post) {
    return { success: false as const, error: 'Пост не найден' }
  }

  const currentStatus = getApprovalStatus(post.metadata)
  if (!canTransitionApprovalStatus(currentStatus, nextStatus)) {
    return { success: false as const, error: `Нельзя перевести approval из "${currentStatus}" в "${nextStatus}"` }
  }

  await prisma.post.update({
    where: { id: post.id },
    data: {
      metadata: setApprovalStatus(post.metadata, { nextStatus, userId, note }) as Prisma.InputJsonValue,
      updatedAt: new Date(),
    },
  })

  revalidatePath('/dashboard/calendar')
  return { success: true as const }
}

export async function requestPostApproval(postId: string) {
  return updateApproval(postId, 'REVIEW_PENDING')
}

export async function approvePost(postId: string) {
  return updateApproval(postId, 'APPROVED')
}

export async function rejectPost(postId: string, note?: string) {
  return updateApproval(postId, 'REJECTED', note)
}
