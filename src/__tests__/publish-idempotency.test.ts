import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock, getPendingPublishQueueItemsMock, revalidatePathMock } = vi.hoisted(() => ({
  prismaMock: {
    post: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    generation: {
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  getPendingPublishQueueItemsMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/publish/queue/upstash', () => ({
  enqueuePublishQueueItem: vi.fn(),
  getPendingPublishQueueItems: getPendingPublishQueueItemsMock,
}))

vi.mock('@/lib/publish/providers/telegram', () => ({
  publishToTelegram: vi.fn(),
}))

vi.mock('@/lib/publish/providers/vk', () => ({
  publishToVk: vi.fn(),
}))

vi.mock('@/lib/publish/providers/dzen', () => ({
  publishToDzen: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}))

vi.mock('@/lib/platform-credentials/actions', () => ({
  getActiveCredentialForPublishing: vi.fn(async () => null),
}))

import { runPendingPublishJobs } from '@/lib/publish/actions'

describe('publish idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('skips duplicate publication when idempotency key already published', async () => {
    prismaMock.post.findMany.mockResolvedValue([])
    getPendingPublishQueueItemsMock.mockResolvedValue([
      {
        generationId: 'gen-1',
        userId: 'user-1',
        postId: 'post-1',
        target: 'TELEGRAM',
        attempt: 0,
        idempotencyKey: 'idem-1',
      },
    ])
    prismaMock.post.findFirst.mockResolvedValue({
      id: 'post-1',
      content: 'text',
      mediaUrls: [],
      metadata: {},
      status: 'PUBLISHED',
      scheduledAt: new Date('2028-01-01T00:00:00.000Z'),
      publishAttempts: 1,
      idempotencyKey: 'idem-1',
    })

    const result = await runPendingPublishJobs('user-1', 20)

    expect(result.success).toBe(true)
    expect(prismaMock.generation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'gen-1' },
        data: expect.objectContaining({
          status: 'COMPLETED',
        }),
      })
    )
    expect(result.data.processedJobs).toBe(1)
    expect(result.data.processedPosts).toBe(0)
  })
})
