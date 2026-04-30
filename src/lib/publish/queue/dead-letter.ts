import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/db'

export async function movePublishJobToDeadLetter(generationId: string, reason: string) {
  const generation = await prisma.generation.findUnique({
    where: { id: generationId },
    select: { metadata: true },
  })

  await prisma.generation.update({
    where: { id: generationId },
    data: {
      status: 'FAILED',
      error: reason,
      metadata: {
        ...(typeof generation?.metadata === 'object' && generation.metadata ? generation.metadata : {}),
        queue: {
          state: 'dlq',
          reason,
          movedAt: new Date().toISOString(),
        },
      } as Prisma.InputJsonValue,
    },
  })
}
