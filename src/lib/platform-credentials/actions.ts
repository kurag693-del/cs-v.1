'use server'

import { Platform } from '@prisma/client'

import { validateSession } from '@/lib/auth/lucia'
import { prisma } from '@/lib/db'
import { decryptSecret, encryptSecret } from '@/lib/security/encryption'

type ConnectPlatformInput = {
  platform: Platform
  brandId: string
  accessToken: string
  refreshToken?: string
  expiresAt?: string
  scopes?: string[]
}

export async function listMyPlatformCredentials() {
  const { user } = await validateSession()
  if (!user?.id) {
    return { success: false as const, error: 'Unauthorized' }
  }

  const credentials = await prisma.platformCredential.findMany({
    where: { userId: user.id, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      platform: true,
      brandId: true,
      isActive: true,
      expiresAt: true,
      scopes: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return { success: true as const, data: credentials }
}

export async function connectPlatformCredential(input: ConnectPlatformInput) {
  const { user } = await validateSession()
  if (!user?.id) {
    return { success: false as const, error: 'Unauthorized' }
  }

  const brand = await prisma.brand.findFirst({
    where: { id: input.brandId, userId: user.id, deletedAt: null },
    select: { id: true },
  })
  if (!brand) {
    return { success: false as const, error: 'Brand not found' }
  }

  const encryptedAccessToken = encryptSecret(input.accessToken.trim())
  const encryptedRefreshToken = input.refreshToken ? encryptSecret(input.refreshToken.trim()) : null

  const credential = await prisma.platformCredential.upsert({
    where: {
      userId_platform_brandId: {
        userId: user.id,
        platform: input.platform,
        brandId: input.brandId,
      },
    },
    create: {
      userId: user.id,
      brandId: input.brandId,
      platform: input.platform,
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      scopes: input.scopes ?? [],
      isActive: true,
      deletedAt: null,
    },
    update: {
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      scopes: input.scopes ?? [],
      isActive: true,
      deletedAt: null,
      updatedAt: new Date(),
    },
    select: {
      id: true,
      platform: true,
      brandId: true,
      isActive: true,
      expiresAt: true,
      scopes: true,
    },
  })

  return { success: true as const, data: credential }
}

export async function disconnectPlatformCredential(credentialId: string) {
  const { user } = await validateSession()
  if (!user?.id) {
    return { success: false as const, error: 'Unauthorized' }
  }

  await prisma.platformCredential.updateMany({
    where: {
      id: credentialId,
      userId: user.id,
      deletedAt: null,
    },
    data: {
      isActive: false,
      deletedAt: new Date(),
      updatedAt: new Date(),
    },
  })

  return { success: true as const }
}

export async function getActiveCredentialForPublishing(input: {
  userId: string
  brandId?: string | null
  platform: Platform
}) {
  const credential = await prisma.platformCredential.findFirst({
    where: {
      userId: input.userId,
      platform: input.platform,
      brandId: input.brandId ?? undefined,
      isActive: true,
      deletedAt: null,
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      accessToken: true,
      refreshToken: true,
      expiresAt: true,
      scopes: true,
      brandId: true,
    },
  })

  if (!credential) {
    return null
  }

  return {
    id: credential.id,
    accessToken: decryptSecret(credential.accessToken),
    refreshToken: credential.refreshToken ? decryptSecret(credential.refreshToken) : null,
    expiresAt: credential.expiresAt,
    scopes: credential.scopes,
    brandId: credential.brandId,
  }
}
