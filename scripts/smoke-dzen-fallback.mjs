import { spawnSync } from 'node:child_process'

const run = spawnSync('npm', ['run', 'test', '--', 'src/__tests__/publish-dzen-fallback.test.ts'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

if (run.status !== 0) {
  process.exit(run.status ?? 1)
}

console.log('Dzen fallback smoke passed')
