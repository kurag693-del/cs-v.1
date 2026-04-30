# Cloudflare Publish Proxy

Proxy service for app -> platform publishing on Cloudflare Workers.

## Endpoints

- `GET /health`
- `POST /publish`

`POST /publish` payload:

```json
{
  "platform": "telegram|vk|dzen",
  "content": "text",
  "mediaUrls": ["https://..."],
  "metadata": {}
}
```

## Security

Required header:
- `x-publish-proxy-secret: <PUBLISH_PROXY_SECRET>`

For multi-user publishing, app must pass per-user Telegram credential in payload metadata:

```json
{
  "metadata": {
    "credential": {
      "accessToken": "<user_bot_token>",
      "scopes": ["chat_id:@user_channel_or_-100..."]
    }
  }
}
```

Worker runs in strict multi-tenant mode for Telegram: no env fallback for token/chat_id.

For VK and Dzen, Worker also expects per-user credentials in payload metadata:

```json
{
  "metadata": {
    "credential": {
      "accessToken": "<user_token>",
      "ownerId": "-123456", 
      "scopes": ["owner_id:-123456"]
    }
  }
}
```

`ownerId`/`owner_id:*` applies to VK. Dzen currently uses `credential.accessToken`.

## Modes

- `PUBLISH_PROXY_MODE=sandbox` -> simulated success
- `PUBLISH_PROXY_MODE=production` -> real API calls

## Local Dev

```bash
npm install
npx wrangler login
npm run dev
```

## Deploy

```bash
npx wrangler secret put PUBLISH_PROXY_SECRET
npm run deploy
```

Set app env:

- `PUBLISH_PROXY_URL=https://<worker>.workers.dev/publish`
- `PUBLISH_PROXY_SECRET=<same-secret>`
