import {
  getDefaultOpenRouterTextModel,
  resolveOpenRouterAppTitle,
  resolveOpenRouterHttpReferer,
} from './openrouter-config'
import { OpenAICompatibleProvider } from './openai-compatible-provider'

export const openrouterProvider = new OpenAICompatibleProvider({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: () => (process.env.OPENROUTER_API_KEY ?? '').trim(),
  model: () => getDefaultOpenRouterTextModel(),
  providerId: 'openrouter',
  extraHeaders: () => ({
    'HTTP-Referer': resolveOpenRouterHttpReferer(),
    'X-Title': resolveOpenRouterAppTitle(),
  }),
})
