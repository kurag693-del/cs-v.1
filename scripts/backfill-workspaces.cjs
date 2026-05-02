/**
 * Одноразово после prisma db push: создаёт Workspace + OWNER для пользователей без него
 * и проставляет brand.workspaceId для «личных» брендов.
 *
 * Запуск: node -e "require('dotenv').config({path:'.env.local'})" && node scripts/backfill-workspaces.cjs
 */

require('dotenv').config({ path: '.env.local' })

const { PrismaClient, WorkspaceMemberRole } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
  })

  for (const u of users) {
    const hasOwnerMembership = await prisma.workspaceMember.findFirst({
      where: { userId: u.id, role: WorkspaceMemberRole.OWNER },
      select: { workspaceId: true },
    })

    if (hasOwnerMembership) {
      await prisma.brand.updateMany({
        where: { userId: u.id, workspaceId: null, deletedAt: null },
        data: { workspaceId: hasOwnerMembership.workspaceId },
      })
      continue
    }

    const ws = await prisma.workspace.create({
      data: {
        name: u.name?.trim() || 'Моё пространство',
        ownerId: u.id,
        members: {
          create: {
            userId: u.id,
            role: WorkspaceMemberRole.OWNER,
          },
        },
      },
    })

    await prisma.brand.updateMany({
      where: { userId: u.id, workspaceId: null, deletedAt: null },
      data: { workspaceId: ws.id },
    })
  }

  console.log('backfill-workspaces: done for', users.length, 'users')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
