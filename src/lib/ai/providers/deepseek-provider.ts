import { OpenAICompatibleProvider } from './openai-compatible-provider'

export const deepseekProvider = new OpenAICompatibleProvider({
  baseURL: 'https://api.deepseek.com/v1',
  apiKey: () => (process.env.DEEPSEEK_API_KEY ?? '').trim(),
  model: 'deepseek-chat',
  providerId: 'deepseek',
})
