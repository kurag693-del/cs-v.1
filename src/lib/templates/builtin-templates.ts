import { z } from 'zod'

import type { GenerateTextInput } from '@/lib/validation/generate'

import contentTemplatesCatalog from '../../../prompts/templates/catalog.json'
import { SPHERE_PACKS, SPHERE_PACK_COMPOSITE_SEP } from '@/lib/templates/sphere-packs'

export const templateCategorySchema = z.enum([
  'horeca',
  'beauty',
  'b2b',
  'personal',
  'retail',
  'fitness',
  'education',
  'realestate',
])

export type TemplateCategory = z.infer<typeof templateCategorySchema>

export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  horeca: 'HoReCa',
  beauty: 'Красота',
  b2b: 'B2B / IT',
  personal: 'Личный бренд',
  retail: 'Розница',
  fitness: 'Спорт и ЗОЖ',
  education: 'Образование',
  realestate: 'Недвижимость',
}

export const TEMPLATE_CATEGORY_ORDER: TemplateCategory[] = [
  'horeca',
  'retail',
  'beauty',
  'fitness',
  'b2b',
  'education',
  'realestate',
  'personal',
]

/** Одна ниша из встроенной библиотеки (код, без запросов к БД). */
export const builtinTemplateSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  industry: z.string().min(1).max(400),
  category: templateCategorySchema,
  defaultPrompt: z.string().min(20).max(8000),
  suggestedPlatforms: z.array(z.enum(['Instagram', 'Telegram', 'VK', 'TikTok'])).min(1),
  tone: z.enum(['brand', 'humor', 'formal']),
  defaultContentType: z.enum(['post', 'story', 'tips', 'announcement']).optional(),
  /** Из JSON-сфер: подсказки для промпта и формы. */
  suggestedHashtags: z.array(z.string()).max(40).optional(),
  suggestedCta: z.string().max(500).optional(),
  includeEmojisDefault: z.boolean().optional(),
  nicheToneGuidance: z.string().max(800).optional(),
  contentPillars: z.array(z.string()).max(30).optional(),
})

export type BuiltinTemplate = z.infer<typeof builtinTemplateSchema>

const contentTemplatesCatalogSchema = z.array(builtinTemplateSchema)

function parseContentTemplatesCatalog(raw: unknown): BuiltinTemplate[] {
  const parsed = contentTemplatesCatalogSchema.safeParse(raw)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new Error(`prompts/templates/catalog.json невалиден: ${msg}`)
  }
  const seen = new Set<string>()
  for (const item of parsed.data) {
    if (seen.has(item.id)) {
      throw new Error(`Duplicate template id in catalog.json: ${item.id}`)
    }
    seen.add(item.id)
  }
  return parsed.data
}

function mapSphereCategoryToTemplateCategory(cat: string): TemplateCategory {
  const key = cat.trim().toLowerCase()
  const map: Record<string, TemplateCategory> = {
    'food-beverage': 'horeca',
    'beauty-wellness': 'beauty',
    technology: 'b2b',
    'personal-branding': 'personal',
    retail: 'retail',
    'health-fitness': 'fitness',
    education: 'education',
  }
  return map[key] ?? 'b2b'
}

function mapSphereContentType(raw: string): NonNullable<BuiltinTemplate['defaultContentType']> {
  const x = raw.trim().toLowerCase()
  if (x === 'story' || x === 'reel') return 'story'
  if (x === 'tips') return 'tips'
  if (x === 'announcement') return 'announcement'
  return 'post'
}

function mapSphereToneToOverride(tone: string): BuiltinTemplate['tone'] {
  const t = tone.trim().toLowerCase()
  const humor = ['humor', 'energetic', 'playful', 'witty']
  const formal = [
    'formal',
    'professional',
    'expert',
    'thoughtful',
    'educational',
    'authoritative',
    'helpful',
    'instructive',
  ]
  if (humor.includes(t)) return 'humor'
  if (formal.includes(t)) return 'formal'
  return 'brand'
}

function mapApiPlatformToUi(p: string): 'Instagram' | 'Telegram' | 'VK' | 'TikTok' {
  const u = p.trim().toUpperCase()
  const m: Record<string, 'Instagram' | 'Telegram' | 'VK' | 'TikTok'> = {
    INSTAGRAM: 'Instagram',
    TELEGRAM: 'Telegram',
    VK: 'VK',
    TIKTOK: 'TikTok',
    LINKEDIN: 'VK',
    YOUTUBE: 'TikTok',
  }
  return m[u] ?? 'Instagram'
}

function buildSuggestedPlatformsFromSphere(
  subPlatform: string,
  packPlatforms: string[]
): BuiltinTemplate['suggestedPlatforms'] {
  const primary = mapApiPlatformToUi(subPlatform)
  const fromPack = packPlatforms.map(mapApiPlatformToUi)
  const ordered = [primary, ...fromPack.filter((p) => p !== primary)]
  const unique = Array.from(new Set(ordered))
  return unique as BuiltinTemplate['suggestedPlatforms']
}

function resolveNicheToneGuidance(
  pack: (typeof SPHERE_PACKS)[number],
  subTone: string
): string | undefined {
  const bv = pack.brandVoice
  if (!bv || Object.keys(bv).length === 0) return undefined
  const lower = subTone.toLowerCase()
  const entry = Object.entries(bv).find(([k]) => k.toLowerCase() === lower)
  if (entry) return entry[1]
  const def = pack.defaultTone
  const byDefault = def ? bv[def] : undefined
  if (typeof byDefault === 'string' && byDefault.length > 0) return byDefault
  const first = Object.values(bv)[0]
  return typeof first === 'string' ? first : undefined
}

/** Разворачивает `src/lib/templates/*.json` сферы в плоские шаблоны (`coffee-shop__new-menu-item`). */
export function expandSpherePacksToBuiltinTemplates(): BuiltinTemplate[] {
  const out: BuiltinTemplate[] = []
  for (const pack of SPHERE_PACKS) {
    for (const sub of pack.templates) {
      const compositeId = `${pack.id}${SPHERE_PACK_COMPOSITE_SEP}${sub.id}`
      out.push({
        id: compositeId,
        name: sub.name,
        industry: `${pack.name} · ${pack.description}`,
        category: mapSphereCategoryToTemplateCategory(pack.category),
        defaultPrompt: sub.prompt.trim(),
        suggestedPlatforms: buildSuggestedPlatformsFromSphere(sub.platform, pack.platforms),
        tone: mapSphereToneToOverride(sub.tone),
        defaultContentType: mapSphereContentType(sub.contentType),
        suggestedHashtags: sub.hashtags.length > 0 ? sub.hashtags : undefined,
        suggestedCta: sub.cta.trim().length > 0 ? sub.cta.trim() : undefined,
        includeEmojisDefault: sub.includeEmojis,
        nicheToneGuidance: resolveNicheToneGuidance(pack, sub.tone),
        contentPillars: pack.contentPillars,
      })
    }
  }
  return out.map((t) => builtinTemplateSchema.parse(t))
}

/** Базовый каталог (`prompts/templates/catalog.json`) + сценарии из JSON-сфер. */
export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  ...parseContentTemplatesCatalog(contentTemplatesCatalog),
  ...expandSpherePacksToBuiltinTemplates(),
]

export function validateBuiltinTemplatesCatalog(): void {
  const seen = new Set<string>()
  for (const item of BUILTIN_TEMPLATES) {
    builtinTemplateSchema.parse(item)
    if (seen.has(item.id)) {
      throw new Error(`Duplicate builtin template id: ${item.id}`)
    }
    seen.add(item.id)
  }
}

export function getBuiltinTemplateById(id: string): BuiltinTemplate | null {
  const found = BUILTIN_TEMPLATES.find((t) => t.id === id)
  return found ? builtinTemplateSchema.parse(found) : null
}

/** Значения для предзаполнения формы генерации (тема остаётся редактируемой). */
export function getTemplateFormPatch(
  template: BuiltinTemplate
): Pick<GenerateTextInput, 'topic' | 'platform' | 'toneOverride' | 'includeEmojis'> & {
  contentType?: GenerateTextInput['contentType']
} {
  return {
    topic: template.defaultPrompt,
    platform: template.suggestedPlatforms[0]!,
    toneOverride: template.tone,
    includeEmojis: template.includeEmojisDefault ?? true,
    ...(template.defaultContentType ? { contentType: template.defaultContentType } : {}),
  }
}

const normalizeSearch = (q: string) => q.trim().toLowerCase()

/** Фильтр по категории и подстроке в названии / нише / id. */
export function filterBuiltinTemplates(options: {
  category: TemplateCategory | 'all'
  search: string
}): BuiltinTemplate[] {
  const q = normalizeSearch(options.search)
  return BUILTIN_TEMPLATES.filter((t) => {
    if (options.category !== 'all' && t.category !== options.category) return false
    if (!q) return true
    return (
      t.name.toLowerCase().includes(q) ||
      t.industry.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q)
    )
  })
}

/** Избранное и «основной» шаблон — в начале списка, остальные по порядку категорий и имени. */
export function orderBuiltinTemplatesForUi(
  templates: BuiltinTemplate[],
  favoriteIds: string[],
  preferredId: string | null | undefined
): BuiltinTemplate[] {
  const byId = new Map(templates.map((t) => [t.id, t] as const))

  const picked: BuiltinTemplate[] = []
  const seen = new Set<string>()

  const pushId = (id: string) => {
    const t = byId.get(id)
    if (t && !seen.has(id)) {
      seen.add(id)
      picked.push(t)
    }
  }

  if (preferredId) pushId(preferredId)
  for (const id of favoriteIds) {
    pushId(id)
  }

  const rest = templates
    .filter((t) => !seen.has(t.id))
    .sort((a, b) => {
      const ca = TEMPLATE_CATEGORY_ORDER.indexOf(a.category)
      const cb = TEMPLATE_CATEGORY_ORDER.indexOf(b.category)
      if (ca !== cb) return ca - cb
      return a.name.localeCompare(b.name, 'ru')
    })

  return [...picked, ...rest]
}
