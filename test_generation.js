// Quick test of the generation system
const { prisma } = require('./src/lib/db')

async function test() {
  console.log('=== AI Generation System Test ===\n')

  // 1. Check router
  console.log('1. Testing model router...')
  const { routeModel } = require('./src/lib/ai/router')
  const route = routeModel('social_post', 'FREE')
  console.log('   Route:', JSON.stringify(route, null, 2))
  console.log('   ✓ Model selected:', route.model)
  console.log('   ✓ Estimated cost:', route.estimatedCost)
  console.log('')

  // 2. Check moderation
  console.log('2. Testing content moderation...')
  const { moderator } = require('./src/lib/ai/moderation')
  const clean = await moderator.moderateContent('Create a post about AI innovation')
  console.log('   Clean prompt:', clean.isApproved ? '✓ Approved' : '✗ Blocked')
  const toxic = await moderator.moderateContent('This is fucking bullshit and I hate everyone')
  console.log('   Toxic prompt:', toxic.isApproved ? '✗ Should be blocked' : '✓ Blocked')
  console.log('')

  // 3. Check database
  console.log('3. Checking Prisma connection...')
  try {
    const users = await prisma.user.findMany({ take: 1 })
    console.log('   ✓ Prisma connected, users found:', users.length)
  } catch (e) {
    console.log('   ✗ Prisma error:', e.message)
  }
  console.log('')

  // 4. Check file structure
  console.log('4. Checking /src/lib/ai/ structure...')
  const fs = require('fs')
  const aiDir = '/project/creativestudio/src/lib/ai'
  const files = fs.readdirSync(aiDir)
  console.log('   Files:', files.join(', '))
  console.log('')

  console.log('=== Test Complete ===')
}

test().catch(console.error)
