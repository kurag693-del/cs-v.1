'use server'

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { movePublishJobToDeadLetter } from '@/lib/publish/queue/dead-letter'
import { getRetryDelayMs, shouldMoveToDlq } from '@/lib/publish/queue/retry-policy'
import { enqueuePublishQueueItem, getPendingPublishQueueItems } from '@/lib/publish/queue/upstash'
import { publishToDzen } from '@/lib/publish/providers/dzen'
import { publishToTelegram } from '@/lib/publish/providers/telegram'
import { publishToVk } from '@/lib/publish/providers/vk'
import { canTransitionPostStatus } from '@/lib/publish/state-machine'
import { EnqueuePublishJobSchema, type PublishTarget } from '@/lib/validation/publish'
import { getActiveCredentialForPublishing } from '@/lib/platform-credentials/actions'
import { revalidatePath } from 'next/cache'
import { getApprovalStatus } from '@/lib/approval/workflow'
import { scheduleEngagementSyncAfterPublish } from '@/lib/analytics/engagement-after-publish'
import { assertUserCanScheduleOrPublishPost } from '@/lib/workspace/publish-guard'

function resolvePublishTarget(platform: string): PublishTarget {
  if (platform === 'TELEGRAM') return 'TELEGRAM'
  if (platform === 'VK') return 'VK'
  return 'DZEN'
}

function randomIdempotencyKey(postId: string): string {
  return `publish-${postId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export async function enqueuePublishJob(userId: string, postId: string, target: PublishTarget) {
  const parsed = EnqueuePublishJobSchema.safeParse({ postId, target })
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Invalid publish payload' }
  }

  const post = await prisma.post.findFirst({
    where: { id: postId, userId, deletedAt: null },
    select: {
      id: true,
      userId: true,
      brandId: true,
      idempotencyKey: true,
      publishAttempts: true,
      status: true,
    },
  })

  if (!post) {
    return { success: false, error: 'Post not found' }
  }

  const publishGate = await assertUserCanScheduleOrPublishPost({
    actorUserId: userId,
    post: { userId: post.userId, brandId: post.brandId },
  })
  if (!publishGate.ok) {
    return { success: false as const, error: publishGate.message }
  }

  const idempotencyKey = post.idempotencyKey ?? randomIdempotencyKey(post.id)

  if (!post.idempotencyKey) {
    await prisma.post.update({
      where: { id: post.id },
      data: { idempotencyKey },
    })
  }

  const job = await enqueuePublishQueueItem({
    userId,
    postId,
    target,
    idempotencyKey,
  })

  revalidatePath('/dashboard/calendar')
  return { success: true, data: job }
}

export async function runPendingPublishJobs(userId: string, limit = 20) {
  const dueScheduledPosts = await prisma.post.findMany({
    where: {
      userId,
      status: 'SCHEDULED',
      deletedAt: null,
      scheduledAt: {
        lte: new Date(),
      },
    },
    orderBy: { scheduledAt: 'asc' },
    take: limit,
    select: {
      id: true,
      platform: true,
      metadata: true,
      idempotencyKey: true,
    },
  })

  for (const post of dueScheduledPosts) {
    const target = resolvePublishTarget(post.platform)
    const idempotencyKey = post.idempotencyKey ?? randomIdempotencyKey(post.id)
    await prisma.post.update({
      where: { id: post.id },
      data: { idempotencyKey },
    })
    await enqueuePublishQueueItem({
      userId,
      postId: post.id,
      target,
      idempotencyKey,
    })
  }

  const queueItems = await getPendingPublishQueueItems(userId, limit)
  let processedJobs = 0
  let processedPosts = 0
  let failedJobs = 0
  let dzenFallbackCount = 0

  for (const item of queueItems) {
    const post = await prisma.post.findFirst({
      where: {
        id: item.postId,
        userId,
        deletedAt: null,
      },
      select: {
        id: true,
        content: true,
        mediaUrls: true,
        metadata: true,
        platform: true,
        brandId: true,
        status: true,
        scheduledAt: true,
        publishAttempts: true,
        idempotencyKey: true,
      },
    })

    if (!post) {
      await movePublishJobToDeadLetter(item.generationId, 'Post not found')
      failedJobs += 1
      continue
    }

    if (post.status === 'PUBLISHED' && post.idempotencyKey === item.idempotencyKey) {
      await prisma.generation.update({
        where: { id: item.generationId },
        data: {
          status: 'COMPLETED',
          output: 'Skipped duplicate by idempotency key',
        },
      })
      processedJobs += 1
      continue
    }

    const transition = canTransitionPostStatus(post.status, 'PUBLISHED', { scheduledAt: post.scheduledAt })
    if (!transition.valid && post.status !== 'SCHEDULED') {
      await movePublishJobToDeadLetter(item.generationId, transition.message)
      failedJobs += 1
      continue
    }

    const publishMetadata: Record<string, unknown> =
      typeof post.metadata === 'object' && post.metadata && !Array.isArray(post.metadata)
        ? (post.metadata as Record<string, unknown>)
        : {}
    const approvalStatus = getApprovalStatus(post.metadata)
    if (approvalStatus !== 'APPROVED') {
      failedJobs += 1
      await prisma.generation.update({
        where: { id: item.generationId },
        data: {
          status: 'PENDING',
          error: 'Ожидает одобрения (APPROVED) перед публикацией',
          metadata: {
            postId: item.postId,
            target: item.target,
            queueState: 'waiting_approval',
            approvalStatus,
          },
        },
      })
      continue
    }
    const credential = await getActiveCredentialForPublishing({
      userId,
      brandId: post.brandId,
      platform: post.platform,
    })
    if (!credential) {
      const noCredentialError = `Платформа ${post.platform} не подключена для выбранного бренда`
      await prisma.post.update({
        where: { id: post.id },
        data: {
          status: 'FAILED',
          publishAttempts: (post.publishAttempts ?? 0) + 1,
          lastError: noCredentialError,
        },
      })
      await movePublishJobToDeadLetter(item.generationId, noCredentialError)
      failedJobs += 1
      continue
    }

    const publishResult =
      item.target === 'TELEGRAM'
        ? await publishToTelegram({
            content: post.content,
            mediaUrls: post.mediaUrls,
            metadata: {
              ...publishMetadata,
              publishContext: {
                userId,
                brandId: post.brandId,
                postId: post.id,
                target: item.target,
              },
            },
            credential,
          })
        : item.target === 'VK'
          ? await publishToVk({
              content: post.content,
              mediaUrls: post.mediaUrls,
              metadata: {
                ...publishMetadata,
                publishContext: {
                  userId,
                  brandId: post.brandId,
                  postId: post.id,
                  target: item.target,
                },
              },
              credential,
            })
          : await publishToDzen({
              content: post.content,
              mediaUrls: post.mediaUrls,
              metadata: {
                ...publishMetadata,
                publishContext: {
                  userId,
                  brandId: post.brandId,
                  postId: post.id,
                  target: item.target,
                },
              },
              credential,
            })

    if (publishResult.success) {
      const dzenFallbackUsed = item.target === 'DZEN' && 'fallbackUsed' in publishResult && publishResult.fallbackUsed
      const fallbackInfo =
        dzenFallbackUsed
          ? {
              fallback: {
                used: true,
                reason: ('fallbackReason' in publishResult ? publishResult.fallbackReason : undefined) ?? 'Dzen API unavailable',
                markdown: ('markdown' in publishResult ? publishResult.markdown : undefined) ?? '',
                exportHint: ('exportHint' in publishResult ? publishResult.exportHint : undefined) ?? '',
                rssHint: ('rssHint' in publishResult ? publishResult.rssHint : undefined) ?? '',
              },
            }
          : {}

      await prisma.$transaction(async (tx) => {
        await tx.post.update({
          where: { id: post.id },
          data: {
            status: 'PUBLISHED',
            publishedAt: new Date(),
            lastError: null,
            metadata: {
              ...publishMetadata,
              publish: {
                provider: item.target,
                externalId: publishResult.externalId,
                publishedAt: new Date().toISOString(),
                idempotencyKey: item.idempotencyKey,
              },
              ...fallbackInfo,
            } as Prisma.InputJsonValue,
          },
        })

        await tx.generation.update({
          where: { id: item.generationId },
          data: {
            status: 'COMPLETED',
            output: `Delivered to ${item.target}`,
            metadata: {
              postId: item.postId,
              target: item.target,
              state: 'sent',
              sentAt: new Date().toISOString(),
              idempotencyKey: item.idempotencyKey,
              ...(dzenFallbackUsed
                ? {
                    fallback: {
                      used: true,
                      reason:
                        ('fallbackReason' in publishResult ? publishResult.fallbackReason : undefined) ??
                        'Dzen API unavailable',
                    },
                  }
                : {}),
            },
          },
        })
      })

      if (dzenFallbackUsed) {
        dzenFallbackCount += 1
      }
      processedPosts += 1
      processedJobs += 1
      scheduleEngagementSyncAfterPublish(post.id, userId, item.target)
      continue
    }

    const nextAttempt = (post.publishAttempts ?? 0) + 1
    const errorMessage = publishResult.error

    if (shouldMoveToDlq(nextAttempt)) {
      await prisma.post.update({
        where: { id: post.id },
        data: {
          status: 'FAILED',
          publishAttempts: nextAttempt,
          lastError: errorMessage,
        },
      })
      await movePublishJobToDeadLetter(item.generationId, errorMessage)
      failedJobs += 1
      continue
    }

    await prisma.$transaction(async (tx) => {
      await tx.post.update({
        where: { id: post.id },
        data: {
          publishAttempts: nextAttempt,
          lastError: errorMessage,
          status: 'SCHEDULED',
          scheduledAt: new Date(Date.now() + getRetryDelayMs(nextAttempt)),
        },
      })

      await tx.generation.update({
        where: { id: item.generationId },
        data: {
          status: 'PENDING',
          error: errorMessage,
          metadata: {
            postId: item.postId,
            target: item.target,
            attempt: nextAttempt,
            idempotencyKey: item.idempotencyKey,
            queueState: 'retrying',
          },
        },
      })
    })

    failedJobs += 1
  }

  revalidatePath('/dashboard/calendar')
  return {
    success: true,
    data: {
      processed: processedJobs + processedPosts,
      processedPosts,
      processedJobs,
      failedJobs,
      dzenFallbackCount,
      dueScheduledCount: dueScheduledPosts.length,
      pendingJobsCount: queueItems.length,
    },
  }
}

export async function listPublishJobs(userId: string) {
  const jobs = await prisma.generation.findMany({
    where: {
      userId,
      type: 'publish_job',
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return {
    success: true,
    data: jobs.map((job) => ({
      id: job.id,
      status: job.status,
      description: job.prompt,
      result: job.output,
      createdAt: job.createdAt,
      metadata: job.metadata,
    })),
  }
}
