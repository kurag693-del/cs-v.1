/**
 * Удаляет всех пользователей из БД (каскад Prisma/БД). Только для локальной разработки.
 * Запуск: node -e "require('dotenv').config({ path: '.env.local' })" && node scripts/delete-all-users.cjs
 */
require('dotenv').config({ path: '.env.local' })

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const result = await prisma.user.deleteMany({})
  console.log('Удалено пользователей:', result.count)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
