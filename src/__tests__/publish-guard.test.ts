import { describe, expect, it, vi, beforeEach } from 'vitest'

import { assertUserCanScheduleOrPublishPost } from '@/lib/workspace/publish-guard'

const prismaMock = vi.hoisted(() => ({
  brandFindFirst: vi.fn(),
  workspaceMemberFindUnique: vi.fn(),
  workspaceFindFirst: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    brand: {
      findFirst: prismaMock.brandFindFirst,
    },
    workspaceMember: {
      findUnique: prismaMock.workspaceMemberFindUnique,
    },
    workspace: {
      findFirst: prismaMock.workspaceFindFirst,
    },
  },
}))

describe('assertUserCanScheduleOrPublishPost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('forbids when actor is not post author', async () => {
    const r = await assertUserCanScheduleOrPublishPost({
      actorUserId: 'u2',
      post: { userId: 'u1', brandId: null },
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('FORBIDDEN')
  })

  it('allows personal post without brand', async () => {
    const r = await assertUserCanScheduleOrPublishPost({
      actorUserId: 'u1',
      post: { userId: 'u1', brandId: null },
    })
    expect(r).toEqual({ ok: true })
    expect(prismaMock.brandFindFirst).not.toHaveBeenCalled()
  })

  it('legacy brand without workspace: allows owner', async () => {
    prismaMock.brandFindFirst.mockResolvedValueOnce({
      userId: 'u1',
      workspaceId: null,
    })
    const r = await assertUserCanScheduleOrPublishPost({
      actorUserId: 'u1',
      post: { userId: 'u1', brandId: 'b1' },
    })
    expect(r).toEqual({ ok: true })
  })

  it('legacy brand without workspace: forbids non-owner', async () => {
    prismaMock.brandFindFirst.mockResolvedValueOnce({
      userId: 'owner',
      workspaceId: null,
    })
    const r = await assertUserCanScheduleOrPublishPost({
      actorUserId: 'other',
      post: { userId: 'other', brandId: 'b1' },
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('FORBIDDEN')
  })

  it('workspace brand: forbids when user is not a member', async () => {
    prismaMock.brandFindFirst.mockResolvedValueOnce({
      userId: 'owner',
      workspaceId: 'ws1',
    })
    prismaMock.workspaceMemberFindUnique.mockResolvedValueOnce(null)
    const r = await assertUserCanScheduleOrPublishPost({
      actorUserId: 'u1',
      post: { userId: 'u1', brandId: 'b1' },
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('FORBIDDEN')
  })

  it('workspace brand: VIEWER cannot publish to channels', async () => {
    prismaMock.brandFindFirst.mockResolvedValueOnce({
      userId: 'owner',
      workspaceId: 'ws1',
    })
    prismaMock.workspaceMemberFindUnique.mockResolvedValueOnce({ role: 'VIEWER' })
    const r = await assertUserCanScheduleOrPublishPost({
      actorUserId: 'u1',
      post: { userId: 'u1', brandId: 'b1' },
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('FORBIDDEN')
  })

  it('workspace brand: EDITOR blocked when editorsCanPublish is false', async () => {
    prismaMock.brandFindFirst.mockResolvedValueOnce({
      userId: 'owner',
      workspaceId: 'ws1',
    })
    prismaMock.workspaceMemberFindUnique.mockResolvedValueOnce({ role: 'EDITOR' })
    prismaMock.workspaceFindFirst.mockResolvedValueOnce({
      settings: { editorsCanPublish: false },
      ownerId: 'owner',
    })
    const r = await assertUserCanScheduleOrPublishPost({
      actorUserId: 'u1',
      post: { userId: 'u1', brandId: 'b1' },
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('EDITOR_PUBLISH_DISABLED')
  })

  it('workspace brand: EDITOR allowed when editorsCanPublish is true', async () => {
    prismaMock.brandFindFirst.mockResolvedValueOnce({
      userId: 'owner',
      workspaceId: 'ws1',
    })
    prismaMock.workspaceMemberFindUnique.mockResolvedValueOnce({ role: 'EDITOR' })
    prismaMock.workspaceFindFirst.mockResolvedValueOnce({
      settings: { editorsCanPublish: true },
      ownerId: 'owner',
    })
    const r = await assertUserCanScheduleOrPublishPost({
      actorUserId: 'u1',
      post: { userId: 'u1', brandId: 'b1' },
    })
    expect(r).toEqual({ ok: true })
  })

  it('workspace brand: ADMIN always allowed', async () => {
    prismaMock.brandFindFirst.mockResolvedValueOnce({
      userId: 'owner',
      workspaceId: 'ws1',
    })
    prismaMock.workspaceMemberFindUnique.mockResolvedValueOnce({ role: 'ADMIN' })
    prismaMock.workspaceFindFirst.mockResolvedValueOnce({
      settings: { editorsCanPublish: false },
      ownerId: 'owner',
    })
    const r = await assertUserCanScheduleOrPublishPost({
      actorUserId: 'u1',
      post: { userId: 'u1', brandId: 'b1' },
    })
    expect(r).toEqual({ ok: true })
  })
})
