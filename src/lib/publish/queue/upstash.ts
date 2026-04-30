import { prisma } from '@/lib/db'
import { type PublishTarget } from '@/lib/validation/publish'

export type PublishQueueItem = {
  generationId: string
  userId: string
  postId: string
  target: PublishTarget
  attempt: number
  idempotencyKey: string
}

export async function enqueuePublishQueueItem(input: {
  userId: string
  postId: string
  target: PublishTarget
  idempotencyKey: string
}): Promise<PublishQueueItem> {
  const existingPending = await prisma.generation.findMany({
    where: {
      userId: input.userId,
      type: 'publish_job',
      status: 'PENDING',
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      metadata: true,
    },
  })

  const duplicate = existingPending.find((job) => {
    const metadata =
      typeof job.metadata === 'object' && job.metadata && !Array.isArray(job.metadata)
        ? (job.metadata as Record<string, unknown>)
        : null
    return (
      metadata?.postId === input.postId &&
      metadata?.target === input.target &&
      metadata?.idempotencyKey === input.idempotencyKey
    )
  })

  if (duplicate) {
    return {
      generationId: duplicate.id,
      userId: input.userId,
      postId: input.postId,
      target: input.target,
      attempt: 0,
      idempotencyKey: input.idempotencyKey,
    }
  }

  const job = await prisma.generation.create({
    data: {
      userId: input.userId,
      type: 'publish_job',
      prompt: `Publish ${input.postId} to ${input.target}`,
      output: 'Queued',
      status: 'PENDING',
      model: 'publish_queue',
      tokens: 0,
      metadata: {
        postId: input.postId,
        target: input.target,
        attempt: 0,
        idempotencyKey: input.idempotencyKey,
        queueState: 'queued',
      },
    },
  })

  return {
    generationId: job.id,
    userId: input.userId,
    postId: input.postId,
    target: input.target,
    attempt: 0,
    idempotencyKey: input.idempotencyKey,
  }
}

export async function getPendingPublishQueueItems(userId: string, limit: number): Promise<PublishQueueItem[]> {
  const jobs = await prisma.generation.findMany({
    where: {
      userId,
      type: 'publish_job',
      status: 'PENDING',
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: {
      id: true,
      userId: true,
      metadata: true,
    },
  })

  return jobs
    .map((job) => {
      const metadata =
        typeof job.metadata === 'object' && job.metadata && !Array.isArray(job.metadata)
          ? (job.metadata as Record<string, unknown>)
          : null
      const postId = typeof metadata?.postId === 'string' ? metadata.postId : null
      const target = typeof metadata?.target === 'string' ? metadata.target : null
      const attempt = typeof metadata?.attempt === 'number' ? metadata.attempt : 0
      const idempotencyKey = typeof metadata?.idempotencyKey === 'string' ? metadata.idempotencyKey : null
      if (!postId || !target || !idempotencyKey) return null
      if (target !== 'VK' && target !== 'TELEGRAM' && target !== 'DZEN') return null
      return {
        generationId: job.id,
        userId: job.userId,
        postId,
        target,
        attempt,
        idempotencyKey,
      } satisfies PublishQueueItem
    })
    .filter((item): item is PublishQueueItem => item !== null)
}
