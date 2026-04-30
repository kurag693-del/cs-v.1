import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  prismaMock,
  getPendingPublishQueueItemsMock,
  publishToTelegramMock,
  moveToDlqMock,
  getActiveCredentialForPublishingMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
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
  publishToTelegramMock: vi.fn(),
  moveToDlqMock: vi.fn(),
  getActiveCredentialForPublishingMock: vi.fn(),
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
  publishToTelegram: publishToTelegramMock,
}))

vi.mock('@/lib/publish/providers/vk', () => ({
  publishToVk: vi.fn(),
}))

vi.mock('@/lib/publish/providers/dzen', () => ({
  publishToDzen: vi.fn(),
}))

vi.mock('@/lib/publish/queue/dead-letter', () => ({
  movePublishJobToDeadLetter: moveToDlqMock,
}))

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}))

vi.mock('@/lib/platform-credentials/actions', () => ({
  getActiveCredentialForPublishing: getActiveCredentialForPublishingMock,
}))

import { runPendingPublishJobs } from '@/lib/publish/actions'

describe('publish DLQ fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getActiveCredentialForPublishingMock.mockResolvedValue({
      id: 'cred-1',
      accessToken: 'token',
      refreshToken: null,
      expiresAt: null,
      scopes: [],
      brandId: 'brand-1',
    })
  })

  it('moves job to DLQ when attempts exceed limit', async () => {
    prismaMock.post.findMany.mockResolvedValue([])
    getPendingPublishQueueItemsMock.mockResolvedValue([
      {
        generationId: 'gen-1',
        userId: 'user-1',
        postId: 'post-1',
        target: 'TELEGRAM',
        attempt: 4,
        idempotencyKey: 'idem-1',
      },
    ])
    prismaMock.post.findFirst.mockResolvedValue({
      id: 'post-1',
      content: 'text',
      mediaUrls: [],
      metadata: {},
      platform: 'TELEGRAM',
      brandId: 'brand-1',
      status: 'SCHEDULED',
      scheduledAt: new Date('2028-01-01T00:00:00.000Z'),
      publishAttempts: 4,
      idempotencyKey: 'idem-1',
    })
    publishToTelegramMock.mockResolvedValue({ success: false, error: 'token expired' })

    const result = await runPendingPublishJobs('user-1', 20)

    expect(result.success).toBe(true)
    expect(prismaMock.post.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'post-1' },
        data: expect.objectContaining({
          status: 'FAILED',
          publishAttempts: 5,
        }),
      })
    )
    expect(moveToDlqMock).toHaveBeenCalledWith('gen-1', 'token expired')
    expect(result.data.failedJobs).toBe(1)
  })
})
