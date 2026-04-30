import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock, revalidatePathMock } = vi.hoisted(() => ({
  prismaMock: {
    post: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  revalidatePathMock: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}))

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}))

vi.mock('@/lib/auth/lucia', () => ({
  validateSession: vi.fn(async () => ({ user: { id: 'user-1' } })),
}))

import { schedulePost } from '@/lib/posts/actions'

describe('schedulePost concurrency behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => Promise<void>) => {
      await callback(prismaMock)
    })
  })

  it('is idempotent for repeated same schedule updates', async () => {
    const dateIso = '2028-01-01T10:00:00.000Z'
    prismaMock.post.findFirst.mockResolvedValue({
      id: 'post-1',
      status: 'SCHEDULED',
      scheduledAt: new Date(dateIso),
      metadata: {},
    })

    const first = await schedulePost('post-1', dateIso)
    const second = await schedulePost('post-1', dateIso)

    expect(first).toEqual({ success: true })
    expect(second).toEqual({ success: true })
    expect(prismaMock.post.update).not.toHaveBeenCalled()
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it('applies an update when concurrent request changes to a new date', async () => {
    prismaMock.post.findFirst.mockResolvedValueOnce({
      id: 'post-1',
      status: 'SCHEDULED',
      scheduledAt: new Date('2028-01-01T10:00:00.000Z'),
      metadata: {},
    })
    prismaMock.post.findFirst.mockResolvedValueOnce({
      id: 'post-1',
      status: 'SCHEDULED',
      scheduledAt: new Date('2028-01-01T10:00:00.000Z'),
      metadata: {},
    })

    const first = await schedulePost('post-1', '2028-01-01T10:00:00.000Z')
    const second = await schedulePost('post-1', '2028-01-01T12:30:00.000Z')

    expect(first).toEqual({ success: true })
    expect(second).toEqual({ success: true })
    expect(prismaMock.post.update).toHaveBeenCalledTimes(1)
    expect(prismaMock.post.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'post-1' },
        data: expect.objectContaining({
          status: 'SCHEDULED',
          scheduledAt: new Date('2028-01-01T12:30:00.000Z'),
        }),
      })
    )
    expect(revalidatePathMock).toHaveBeenCalledWith('/dashboard/calendar')
  })
})
