'use server'

import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { CreateBrandSchema, UpdateBrandSchema, type Result } from '@/lib/validation/brand'
import { canUserMutateBrand } from '@/lib/brands/access'
import { ensurePersonalWorkspace } from '@/lib/workspace/actions'
import { revalidatePath } from 'next/cache'

type BrandInput = FormData | Record<string, unknown>

function parseBrandExamples(examples?: string): string[] {
  if (!examples || !examples.trim()) return []
  try {
    const parsed = JSON.parse(examples) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  } catch {
    return []
  }
}

function normalizeBrandInput(data: BrandInput) {
  if (data instanceof FormData) {
    return {
      name: data.get('name') as string,
      description: (data.get('description') as string) || undefined,
      tone: data.get('tone') as string,
      voice: (data.get('voice') as string) || undefined,
      vocabularyRules: JSON.parse((data.get('vocabularyRules') as string) || '[]'),
      colors: JSON.parse((data.get('colors') as string) || '[]'),
      forbiddenWords: JSON.parse((data.get('forbiddenWords') as string) || '[]'),
      structureTemplate: (data.get('structureTemplate') as string) || undefined,
      examples: (data.get('examples') as string) || undefined,
      website: (data.get('website') as string) || undefined,
      industry: (data.get('industry') as string) || undefined,
      isActive: (data.get('isActive') as string) === 'true',
    }
  }

  return {
    name: typeof data.name === 'string' ? data.name : '',
    description: typeof data.description === 'string' ? data.description : undefined,
    tone: typeof data.tone === 'string' ? data.tone : '',
    voice: typeof data.voice === 'string' ? data.voice : undefined,
    vocabularyRules: Array.isArray(data.vocabularyRules) ? data.vocabularyRules : [],
    colors: Array.isArray(data.colors) ? data.colors : [],
    forbiddenWords: Array.isArray(data.forbiddenWords) ? data.forbiddenWords : [],
    structureTemplate: typeof data.structureTemplate === 'string' ? data.structureTemplate : undefined,
    examples: typeof data.examples === 'string' ? data.examples : undefined,
    website: typeof data.website === 'string' ? data.website : undefined,
    industry: typeof data.industry === 'string' ? data.industry : undefined,
    isActive: typeof data.isActive === 'boolean' ? data.isActive : false,
  }
}

export async function createBrand(data: BrandInput, userId: string): Promise<Result<any>> {
  try {
    const workspaceId = await ensurePersonalWorkspace(userId)

    const rawData = normalizeBrandInput(data)

    const validated = CreateBrandSchema.safeParse(rawData)

    if (!validated.success) {
      return {
        success: false,
        error: 'Ошибка валидации',
        details: validated.error.flatten().fieldErrors,
      }
    }

    const {
      name,
      description,
      tone,
      voice,
      colors,
      website,
      industry,
      isActive,
      forbiddenWords,
      examples,
      vocabularyRules,
      structureTemplate,
    } = validated.data

    const brand = await prisma.brand.create({
      data: {
        userId,
        workspaceId,
        name,
        description: description ?? null,
        tone,
        voice: voice ?? null,
        colors: colors ?? [],
        website: website || null,
        industry: industry ?? null,
        isActive: isActive ?? true,
        metadata: {
          forbiddenWords: forbiddenWords ?? [],
          examples: parseBrandExamples(examples),
          vocabularyRules: vocabularyRules ?? [],
          structureTemplate: structureTemplate ?? '',
        } as Prisma.InputJsonValue,
      },
    })

    revalidatePath('/dashboard/brands')

    return {
      success: true,
      data: brand,
    }
  } catch (err: any) {
    console.error('Create brand error:', err)
    return {
      success: false,
      error: err.message || 'Ошибка при создании бренда',
    }
  }
}

export async function getBrands(userId: string) {
  try {
    await ensurePersonalWorkspace(userId)

    const memberships = await prisma.workspaceMember.findMany({
      where: { userId },
      select: { workspaceId: true },
    })
    const workspaceIds = memberships.map((m) => m.workspaceId)

    const brands = await prisma.brand.findMany({
      where: {
        deletedAt: null,
        OR: [{ workspaceId: { in: workspaceIds } }, { userId, workspaceId: null }],
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return {
      success: true,
      data: brands,
    }
  } catch (err: any) {
    console.error('Get brands error:', err)
    return {
      success: false,
      error: err.message || 'Ошибка при загрузке брендов',
    }
  }
}

export async function updateBrand(id: string, data: BrandInput, userId: string): Promise<Result<any>> {
  try {
    const rawData = normalizeBrandInput(data)

    const validated = UpdateBrandSchema.safeParse({ ...rawData, id })

    if (!validated.success) {
      return {
        success: false,
        error: 'Ошибка валидации',
        details: validated.error.flatten().fieldErrors,
      }
    }

    const {
      name,
      description,
      tone,
      voice,
      colors,
      website,
      industry,
      isActive,
      forbiddenWords,
      examples,
      vocabularyRules,
      structureTemplate,
    } = validated.data

    const allowed = await canUserMutateBrand(userId, id)
    if (!allowed) {
      return {
        success: false,
        error: 'Недостаточно прав для изменения бренда',
      }
    }

    const brand = await prisma.brand.update({
      where: {
        id,
        deletedAt: null,
      },
      data: {
        name,
        description: description ?? null,
        tone,
        voice: voice ?? null,
        colors: colors ?? [],
        website: website || null,
        industry: industry ?? null,
        isActive: isActive ?? true,
        metadata: {
          forbiddenWords: forbiddenWords ?? [],
          examples: parseBrandExamples(examples),
          vocabularyRules: vocabularyRules ?? [],
          structureTemplate: structureTemplate ?? '',
        } as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    })

    revalidatePath('/dashboard/brands')

    return {
      success: true,
      data: brand,
    }
  } catch (err: any) {
    console.error('Update brand error:', err)
    return {
      success: false,
      error: err.message || 'Ошибка при обновлении бренда',
    }
  }
}

export async function deleteBrand(id: string, userId: string): Promise<Result<any>> {
  try {
    const allowed = await canUserMutateBrand(userId, id)
    if (!allowed) {
      return {
        success: false,
        error: 'Недостаточно прав для удаления бренда',
      }
    }

    const brand = await prisma.brand.update({
      where: {
        id,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
        isActive: false,
        updatedAt: new Date(),
      },
    })

    revalidatePath('/dashboard/brands')

    return {
      success: true,
      data: brand,
    }
  } catch (err: any) {
    console.error('Delete brand error:', err)
    return {
      success: false,
      error: err.message || 'Ошибка при удалении бренда',
    }
  }
}
