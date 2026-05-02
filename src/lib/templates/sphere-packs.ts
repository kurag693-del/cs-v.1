import { z } from 'zod'

import beautySalon from './beauty-salon.json'
import coffeeShop from './coffee-shop.json'
import ecommerce from './ecommerce.json'
import fitness from './fitness.json'
import itStartup from './it-startup.json'
import onlineEducation from './online-education.json'
import personalBrand from './personal-brand.json'

const sphereSubTemplateSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(160),
  platform: z.string().min(1).max(32),
  contentType: z.string().min(1).max(32),
  prompt: z.string().min(10).max(8000),
  tone: z.string().min(1).max(64),
  includeEmojis: z.boolean(),
  hashtags: z.array(z.string()).max(40),
  cta: z.string().max(500),
  mediaType: z.string().max(32).optional(),
  examples: z.array(z.string()).max(20).optional(),
})

export const spherePackSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(160),
  category: z.string().min(1).max(64),
  description: z.string().min(1).max(2000),
  platforms: z.array(z.string()).min(1),
  defaultTone: z.string().min(1).max(64),
  contentType: z.string().min(1).max(32),
  templates: z.array(sphereSubTemplateSchema).min(1),
  brandVoice: z.record(z.string(), z.string()).optional(),
  contentPillars: z.array(z.string()).max(30).optional(),
  postingFrequency: z.record(z.string(), z.string()).optional(),
  bestTimeToPost: z.record(z.string(), z.array(z.string())).optional(),
})

export type SpherePack = z.infer<typeof spherePackSchema>

export const SPHERE_PACK_COMPOSITE_SEP = '__'

function parsePack(raw: unknown, label: string): SpherePack {
  const parsed = spherePackSchema.safeParse(raw)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new Error(`Шаблон сферы «${label}» невалиден: ${msg}`)
  }
  const seen = new Set<string>()
  for (const t of parsed.data.templates) {
    if (seen.has(t.id)) {
      throw new Error(`Дубликат id подшаблона в ${parsed.data.id}: ${t.id}`)
    }
    seen.add(t.id)
    const composite = `${parsed.data.id}${SPHERE_PACK_COMPOSITE_SEP}${t.id}`
    if (composite.length > 80) {
      throw new Error(`Составной id слишком длинный: ${composite}`)
    }
  }
  return parsed.data
}

/** Все JSON-пакеты по сферам (ниша × сценарии). Источник правды для развёртки в библиотеку генерации. */
export const SPHERE_PACKS: SpherePack[] = [
  parsePack(coffeeShop, 'coffee-shop'),
  parsePack(beautySalon, 'beauty-salon'),
  parsePack(itStartup, 'it-startup'),
  parsePack(personalBrand, 'personal-brand'),
  parsePack(fitness, 'fitness'),
  parsePack(ecommerce, 'ecommerce'),
  parsePack(onlineEducation, 'online-education'),
]
