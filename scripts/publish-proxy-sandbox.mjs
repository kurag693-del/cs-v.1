import http from 'node:http'

const PORT = Number(process.env.PUBLISH_PROXY_PORT || 8787)
const PROXY_SECRET = process.env.PUBLISH_PROXY_SECRET || ''

function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    sendJson(res, 400, { success: false, error: 'Invalid URL' })
    return
  }

  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, { success: true, status: 'ok', mode: 'sandbox' })
    return
  }

  if (req.method !== 'POST' || req.url !== '/publish') {
    sendJson(res, 404, { success: false, error: 'Not found' })
    return
  }

  const headerSecret = req.headers['x-publish-proxy-secret']
  if (PROXY_SECRET && headerSecret !== PROXY_SECRET) {
    sendJson(res, 403, { success: false, error: 'Invalid proxy secret' })
    return
  }

  let body = ''
  req.on('data', (chunk) => {
    body += chunk.toString('utf8')
  })
  req.on('end', () => {
    try {
      const parsed = JSON.parse(body)
      const platform = parsed?.platform
      if (!platform || typeof platform !== 'string') {
        sendJson(res, 400, { success: false, error: 'platform is required' })
        return
      }

      // Sandbox mode: do not call external APIs, only emulate success.
      const externalId = `sandbox-${platform}-${Date.now()}`
      sendJson(res, 200, {
        success: true,
        externalId,
        sandbox: true,
      })
    } catch {
      sendJson(res, 400, { success: false, error: 'Invalid JSON body' })
    }
  })
})

server.listen(PORT, () => {
  console.log(`[publish-proxy-sandbox] listening on http://127.0.0.1:${PORT}`)
  console.log('[publish-proxy-sandbox] health: GET /health')
  console.log('[publish-proxy-sandbox] publish: POST /publish')
})
