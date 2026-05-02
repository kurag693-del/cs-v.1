/**
 * Удаляет пользователей по списку email (каскадно через Prisma).
 * По умолчанию — email из `src/scripts/seed.ts` (`creator@creativestudio.com`).
 *
 * Запуск:
 *   node -e "require('dotenv').config({ path: '.env.local' })" && node scripts/delete-test-users.cjs
 *
 * Свой список:
 *   node scripts/delete-test-users.cjs user1@test.com user2@test.com
 * или   DELETE_TEST_USER_EMAILS="a@x.com,b@y.com" node scripts/delete-test-users.cjs
 */

require('dotenv').config({ path: '.env.local' })

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const FROM_ENV = process.env.DELETE_TEST_USER_EMAILS
const DEFAULT_SEED_EMAIL = 'creator@creativestudio.com'

function resolveEmails() {
  const fromArgv = process.argv.slice(2).filter(Boolean)
  if (fromArgv.length > 0) return fromArgv
  if (typeof FROM_ENV === 'string' && FROM_ENV.trim().length > 0) {
    return FROM_ENV.split(',').map((e) => e.trim()).filter(Boolean)
  }
  return [DEFAULT_SEED_EMAIL]
}

async function main() {
  const emails = resolveEmails()
  console.log('Удаление пользователей с email:', emails.join(', '))

  const result = await prisma.user.deleteMany({
    where: { email: { in: emails } },
  })

  console.log(`Готово. Удалено записей User: ${result.count}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
