'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

type PublishTarget = 'VK' | 'TELEGRAM'

export async function enqueuePublishJob(userId: string, postId: string, target: PublishTarget) {
  const post = await prisma.post.findFirst({
    where: { id: postId, userId, deletedAt: null },
  })

  if (!post) {
    return { success: false, error: 'Post not found' }
  }

  const job = await prisma.generation.create({
    data: {
      userId,
      type: 'publish_job',
      prompt: `Publish ${post.id} to ${target}`,
      output: `Queued publish job for ${target}`,
      status: 'PENDING',
      model: 'system',
      tokens: 0,
      metadata: {
        postId,
        target,
        state: 'queued',
      },
    },
  })

  revalidatePath('/dashboard/calendar')
  return { success: true, data: job }
}

export async function runPendingPublishJobs(userId: string) {
  const jobs = await prisma.generation.findMany({
    where: {
      userId,
      type: 'publish_job',
      status: 'PENDING',
    },
    orderBy: { createdAt: 'asc' },
    take: 20,
  })

  let processed = 0

  for (const job of jobs) {
    await prisma.generation.update({
      where: { id: job.id },
      data: {
        status: 'COMPLETED',
        output: 'Delivered to target channel (simulated)',
        metadata: {
          ...(typeof job.metadata === 'object' && job.metadata ? job.metadata : {}),
          state: 'sent',
          sentAt: new Date().toISOString(),
        },
      },
    })
    processed += 1
  }

  revalidatePath('/dashboard/calendar')
  return { success: true, data: { processed } }
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
