'use server'

import { Prisma } from '@prisma/client'

import { validateSession } from '@/lib/auth/lucia'
import { prisma } from '@/lib/db'
import { getBuiltinTemplateById } from '@/lib/templates/builtin-templates'
import {
  normalizeFavoriteTemplateIds,
  parseTemplatePrefsFromProfile,
  toggleFavoriteInList,
  type TemplatePrefs,
} from '@/lib/templates/template-prefs'

async function getPrimaryProfileId(userId: string): Promise<string | null> {
  const profile = await prisma.profile.findFirst({
    where: { userId, deletedAt: null },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })
  return profile?.id ?? null
}

function mergePreferencesJson(
  prev: Prisma.JsonValue | null | undefined,
  templatePrefs: TemplatePrefs
): Prisma.InputJsonValue {
  const base =
    prev && typeof prev === 'object' && !Array.isArray(prev) ? { ...(prev as Record<string, unknown>) } : {}
  return {
    ...base,
    templatePrefs,
  } as Prisma.InputJsonValue
}

export async function toggleFavoriteBuiltinTemplate(templateId: string): Promise<
  | { success: true; favoriteIds: string[]; isFavorite: boolean }
  | { success: false; error: string }
> {
  if (!getBuiltinTemplateById(templateId)) {
    return { success: false, error: 'Неизвестный шаблон' }
  }

  const { user } = await validateSession()
  if (!user) {
    return { success: false, error: 'Не авторизован' }
  }

  const profileId = await getPrimaryProfileId(user.id)
  if (!profileId) {
    return { success: false, error: 'Профиль не найден' }
  }

  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { preferences: true },
  })

  const parsed = parseTemplatePrefsFromProfile(profile?.preferences)
  const prev = normalizeFavoriteTemplateIds(parsed.favoriteBuiltinTemplateIds)
  const { next } = toggleFavoriteInList(parsed.favoriteBuiltinTemplateIds, templateId)
  const adding = !prev.includes(templateId)
  if (adding && prev.length >= 12 && JSON.stringify(next) === JSON.stringify(prev)) {
    return { success: false, error: 'Список избранного заполнен (максимум 12)' }
  }

  const nextPrefs: TemplatePrefs = {
    ...parsed,
    favoriteBuiltinTemplateIds: next,
  }

  await prisma.profile.update({
    where: { id: profileId },
    data: { preferences: mergePreferencesJson(profile?.preferences, nextPrefs) },
  })

  return { success: true, favoriteIds: next, isFavorite: next.includes(templateId) }
}

export async function setPreferredBuiltinTemplate(
  templateId: string | null
): Promise<{ success: true; preferredId: string | null } | { success: false; error: string }> {
  if (templateId !== null && !getBuiltinTemplateById(templateId)) {
    return { success: false, error: 'Неизвестный шаблон' }
  }

  const { user } = await validateSession()
  if (!user) {
    return { success: false, error: 'Не авторизован' }
  }

  const profileId = await getPrimaryProfileId(user.id)
  if (!profileId) {
    return { success: false, error: 'Профиль не найден' }
  }

  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { preferences: true },
  })

  const parsed = parseTemplatePrefsFromProfile(profile?.preferences)
  const nextPrefs: TemplatePrefs = {
    ...parsed,
    preferredBuiltinTemplateId: templateId,
  }

  await prisma.profile.update({
    where: { id: profileId },
    data: { preferences: mergePreferencesJson(profile?.preferences, nextPrefs) },
  })

  return { success: true, preferredId: templateId }
}

/** Для server components: избранное и «основной» шаблон из `Profile.preferences`. */
export async function getBuiltinTemplatePreferences(): Promise<{
  favoriteIds: string[]
  preferredId: string | null
}> {
  const { user } = await validateSession()
  if (!user) {
    return { favoriteIds: [], preferredId: null }
  }

  const profile = await prisma.profile.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: { preferences: true },
    orderBy: { createdAt: 'asc' },
  })

  const p = parseTemplatePrefsFromProfile(profile?.preferences)
  return {
    favoriteIds: normalizeFavoriteTemplateIds(p.favoriteBuiltinTemplateIds),
    preferredId: p.preferredBuiltinTemplateId ?? null,
  }
}
