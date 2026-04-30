const baseUrl = process.env.PUBLISH_JOBS_BASE_URL || 'http://127.0.0.1:3000'

async function run() {
  const response = await fetch(`${baseUrl}/api/publish/jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-cron-secret': 'wrong-secret',
    },
    body: JSON.stringify({
      userId: 'smoke-user',
      postId: 'smoke-post',
      target: 'TELEGRAM',
    }),
  })

  if (response.status !== 401 && response.status !== 403) {
    const payload = await response.text()
    throw new Error(`Expected 401 or 403 for invalid secret, got ${response.status}: ${payload}`)
  }

  console.log(`Secret check passed: invalid secret returned ${response.status}`)
}

run().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
