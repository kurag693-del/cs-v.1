# Railway Publish Proxy

Minimal proxy service for app -> platform publishing.

## Endpoints

- `GET /health`
- `POST /publish`

`POST /publish` expects:

```json
{
  "platform": "telegram|vk|dzen",
  "content": "text",
  "mediaUrls": ["https://..."],
  "metadata": {}
}
```

Response:

```json
{
  "success": true,
  "externalId": "..."
}
```

## Security

Header required:
- `x-publish-proxy-secret: <PUBLISH_PROXY_SECRET>`

## Modes

- `PUBLISH_PROXY_MODE=sandbox` -> always returns simulated success.
- `PUBLISH_PROXY_MODE=production` -> calls platform APIs.

## Local run

```bash
cp .env.example .env
npm install
npm start
```

Health check:

```bash
curl http://localhost:8787/health
```

## Railway deploy

1. Create new Railway service from this folder.
2. Set env vars from `.env.example`.
3. Set start command to `npm start`.
4. Get public URL and configure app env:
   - `PUBLISH_PROXY_URL=https://<railway-domain>/publish`
   - `PUBLISH_PROXY_SECRET=<same-secret>`
   - keep app in `PUBLISH_MODE=sandbox` for manual testing.
