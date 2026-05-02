const DEFAULT_OPENROUTER_TEXT_MODEL = 'openai/gpt-4o-mini'

/** Короткие имена из `routeModel` → slug на OpenRouter (если env не задан). */
const ROUTE_MODEL_TO_OPENROUTER_SLUG: Record<string, string> = {
  'gpt-4o-mini': 'openai/gpt-4o-mini',
  'gpt-4o': 'openai/gpt-4o',
  'gpt-4': 'openai/gpt-4',
  'claude-3-5-sonnet': 'anthropic/claude-3.5-sonnet',
  'gemini-1.5-pro': 'google/gemini-pro-1.5',
}

/**
 * Slug модели для чата (env перекрывает логический fallback из роутера).
 */
export function resolveOpenRouterTextModel(routeFallback: string): string {
  const fromEnv = process.env.OPENROUTER_MODEL?.trim() || process.env.OPENROUTER_TEXT_MODEL?.trim()
  if (fromEnv) return fromEnv
  return ROUTE_MODEL_TO_OPENROUTER_SLUG[routeFallback] ?? routeFallback
}

export function getDefaultOpenRouterTextModel(): string {
  return resolveOpenRouterTextModel(DEFAULT_OPENROUTER_TEXT_MODEL)
}

export function resolveOpenRouterHttpReferer(): string {
  return (
    process.env.OPENROUTER_HTTP_REFERER?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    'http://localhost:3000'
  )
}

export function resolveOpenRouterAppTitle(): string {
  return process.env.OPENROUTER_APP_TITLE?.trim() || 'Креатив-студия'
}
