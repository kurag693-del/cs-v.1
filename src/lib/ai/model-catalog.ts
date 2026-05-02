import type { SubscriptionTier } from '@prisma/client'

import { resolveOpenRouterTextModel } from '@/lib/ai/providers/openrouter-config'

function parseCommaList(raw?: string | null): string[] {
  if (!raw?.trim()) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export function getTextModelsFree(): string[] {
  return parseCommaList(process.env.AI_TEXT_MODELS_FREE)
}

export function getTextModelsPaid(): string[] {
  return parseCommaList(process.env.AI_TEXT_MODELS_PAID)
}

export function getImageModelsFree(): string[] {
  return parseCommaList(process.env.AI_IMAGE_MODELS_FREE)
}

export function getImageModelsPaid(): string[] {
  return parseCommaList(process.env.AI_IMAGE_MODELS_PAID)
}

function isPaidTier(tier: SubscriptionTier): boolean {
  return tier === 'PRO' || tier === 'ENTERPRISE'
}

export type ModelTierKind = 'free' | 'paid'

export type ModelOption = { slug: string; kind: ModelTierKind }

/** Доступные текстовые модели OpenRouter для тарифа (бесплатные; платные — только PRO/Enterprise). */
export function getOpenRouterTextModelOptions(tier: SubscriptionTier): ModelOption[] {
  const free = getTextModelsFree()
  const paid = getTextModelsPaid()
  const out: ModelOption[] = free.map((slug) => ({ slug, kind: 'free' as const }))
  if (isPaidTier(tier)) {
    const seen = new Set(out.map((o) => o.slug))
    for (const slug of paid) {
      if (!seen.has(slug)) {
        seen.add(slug)
        out.push({ slug, kind: 'paid' })
      }
    }
  }
  return out
}

/** Доступные модели картинок OpenRouter для тарифа. */
export function getOpenRouterImageModelOptions(tier: SubscriptionTier): ModelOption[] {
  const free = getImageModelsFree()
  const paid = getImageModelsPaid()
  const out: ModelOption[] = free.map((slug) => ({ slug, kind: 'free' as const }))
  if (isPaidTier(tier)) {
    const seen = new Set(out.map((o) => o.slug))
    for (const slug of paid) {
      if (!seen.has(slug)) {
        seen.add(slug)
        out.push({ slug, kind: 'paid' })
      }
    }
  }
  return out
}

/** Каталог задан в env (хотя бы один список непустой). */
export function hasOpenRouterTextCatalog(): boolean {
  return getTextModelsFree().length > 0 || getTextModelsPaid().length > 0
}

export function hasOpenRouterImageCatalog(): boolean {
  return getImageModelsFree().length > 0 || getImageModelsPaid().length > 0
}

export function isOpenRouterTextModelAllowed(slug: string, tier: SubscriptionTier): boolean {
  const free = new Set(getTextModelsFree())
  const paid = new Set(getTextModelsPaid())
  if (free.size === 0 && paid.size === 0) return true
  if (free.has(slug)) return true
  if (isPaidTier(tier) && paid.has(slug)) return true
  return false
}

export function isOpenRouterImageModelAllowed(slug: string, tier: SubscriptionTier): boolean {
  const free = new Set(getImageModelsFree())
  const paid = new Set(getImageModelsPaid())
  if (free.size === 0 && paid.size === 0) return true
  if (free.has(slug)) return true
  if (isPaidTier(tier) && paid.has(slug)) return true
  return false
}

const DEFAULT_OR_IMAGE = 'black-forest-labs/flux-schnell'

/**
 * Итоговый slug чата OpenRouter. Явный выбор (уже проверенный) имеет приоритет;
 * иначе первый slug из каталога для тарифа; иначе прежняя логика env + роутера.
 */
export function pickOpenRouterTextModel(
  tier: SubscriptionTier,
  routeFallback: string,
  userChoice?: string | null
): string {
  const trimmed = userChoice?.trim()
  if (trimmed) return trimmed

  const catalog = getOpenRouterTextModelOptions(tier)
  if (catalog.length > 0) return catalog[0]!.slug

  return resolveOpenRouterTextModel(routeFallback)
}

/** Итоговая модель изображения OpenRouter после проверки тарифа на вызывающей стороне. */
export function pickOpenRouterImageModel(tier: SubscriptionTier, userChoice?: string | null): string {
  const trimmed = userChoice?.trim()
  if (trimmed) return trimmed

  const catalog = getOpenRouterImageModelOptions(tier)
  if (catalog.length > 0) return catalog[0]!.slug

  return (
    process.env.OPENROUTER_IMAGE_MODEL?.trim() ||
    process.env.OPENROUTER_MODEL?.trim() ||
    DEFAULT_OR_IMAGE
  )
}
