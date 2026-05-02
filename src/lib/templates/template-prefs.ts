import { z } from 'zod'

/** Вложение в `Profile.preferences` — без миграций БД. */
export const templatePrefsSchema = z.object({
  preferredBuiltinTemplateId: z.string().min(1).max(80).nullable().optional(),
  favoriteBuiltinTemplateIds: z.array(z.string().min(1).max(80)).max(16).optional(),
})

export type TemplatePrefs = z.infer<typeof templatePrefsSchema>

export function parseTemplatePrefsFromProfile(preferences: unknown): TemplatePrefs {
  if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) {
    return {}
  }
  const raw = (preferences as Record<string, unknown>).templatePrefs
  const parsed = templatePrefsSchema.safeParse(raw)
  return parsed.success ? parsed.data : {}
}

const MAX_FAVORITE_TEMPLATES = 12

export function normalizeFavoriteTemplateIds(ids: string[] | undefined): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of ids ?? []) {
    if (seen.has(id)) continue
    seen.add(id)
    out.push(id)
    if (out.length >= MAX_FAVORITE_TEMPLATES) break
  }
  return out
}

export function toggleFavoriteInList(current: string[] | undefined, templateId: string): { next: string[] } {
  const base = normalizeFavoriteTemplateIds(current)
  const idx = base.indexOf(templateId)
  if (idx >= 0) {
    const next = [...base.slice(0, idx), ...base.slice(idx + 1)]
    return { next: normalizeFavoriteTemplateIds(next) }
  }
  if (base.length >= MAX_FAVORITE_TEMPLATES) {
    return { next: base }
  }
  return { next: [...base, templateId] }
}
