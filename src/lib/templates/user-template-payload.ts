import { z } from 'zod'

import { builtinTemplateSchema, type BuiltinTemplate } from '@/lib/templates/builtin-templates'
import type { GenerateTextInput } from '@/lib/validation/generate'

/** Тело шаблона (без id — задаётся в БД). Имя хранится отдельным полем модели. */
export const userTemplatePayloadSchema = builtinTemplateSchema.omit({ id: true, name: true })

export type UserTemplatePayload = z.infer<typeof userTemplatePayloadSchema>

export function parseUserTemplatePayload(raw: unknown): UserTemplatePayload {
  return userTemplatePayloadSchema.parse(raw)
}

/** Совместимо с getTemplateFormPatch для BuiltinTemplate. */
export function userTemplatePayloadToFormPatch(
  name: string,
  payload: UserTemplatePayload
): Pick<GenerateTextInput, 'topic' | 'platform' | 'toneOverride' | 'includeEmojis'> & {
  contentType?: GenerateTextInput['contentType']
} {
  const synthetic: BuiltinTemplate = builtinTemplateSchema.parse({
    id: 'user-template',
    name,
    ...payload,
  })
  return {
    topic: synthetic.defaultPrompt,
    platform: synthetic.suggestedPlatforms[0]!,
    toneOverride: synthetic.tone,
    includeEmojis: synthetic.includeEmojisDefault ?? true,
    ...(synthetic.defaultContentType ? { contentType: synthetic.defaultContentType } : {}),
  }
}
