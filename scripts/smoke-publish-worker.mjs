import { execSync } from 'node:child_process'

try {
  execSync('npm run test -- publish-retry-policy.test.ts publish-idempotency.test.ts publish-dlq.test.ts', {
    stdio: 'inherit',
  })
  console.log('Publish worker smoke passed: retry/idempotency/DLQ checks are green')
} catch (error) {
  process.exit((error && typeof error === 'object' && 'status' in error && typeof error.status === 'number' ? error.status : 1))
}
