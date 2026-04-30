import { execSync } from 'node:child_process'

try {
  execSync('npm run test -- analytics-recommendations.test.ts analytics-metrics.test.ts', {
    stdio: 'inherit',
  })
  console.log('Analytics export smoke passed: recommendations and metrics checks are green')
} catch (error) {
  process.exit(error && typeof error === 'object' && 'status' in error && typeof error.status === 'number' ? error.status : 1)
}
