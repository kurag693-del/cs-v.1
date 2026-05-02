import { prisma } from '@/lib/db'
import { canCreateBrand } from '@/lib/workspace/permissions'

/** Редактирование и удаление бренда: участник workspace с ролью EDITOR и выше. Legacy: только создатель при workspaceId null. */
export async function canUserMutateBrand(userId: string, brandId: string): Promise<boolean> {
  const brand = await prisma.brand.findFirst({
    where: { id: brandId, deletedAt: null },
    select: { userId: true, workspaceId: true },
  })
  if (!brand) return false
  if (!brand.workspaceId) {
    return brand.userId === userId
  }
  const m = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: brand.workspaceId, userId } },
  })
  return m ? canCreateBrand(m.role) : false
}
