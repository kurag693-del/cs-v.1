const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000'
const routes = ['/', '/login', '/dashboard/generate', '/dashboard/calendar']

async function checkRoute(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: 'manual',
  })

  if (response.status >= 500) {
    throw new Error(`Smoke failed: ${path} returned ${response.status}`)
  }
}

async function run() {
  for (const route of routes) {
    await checkRoute(route)
  }
  console.log(`Smoke passed for ${routes.length} routes`)
}

run().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
