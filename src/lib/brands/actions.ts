'use server'

import { prisma } from '@/lib/db'
import { CreateBrandSchema, UpdateBrandSchema, type Result } from '@/lib/validation/brand'
import { revalidatePath } from 'next/cache'

export async function createBrand(data: FormData, userId: string): Promise<Result<any>> {
  try {
    const rawData = {
      name: data.get('name') as string,
      description: (data.get('description') as string) || undefined,
      tone: data.get('tone') as string,
      voice: (data.get('voice') as string) || undefined,
      colors: JSON.parse((data.get('colors') as string) || '[]'),
      forbiddenWords: JSON.parse((data.get('forbiddenWords') as string) || '[]'),
      examples: (data.get('examples') as string) || undefined,
      website: (data.get('website') as string) || undefined,
      industry: (data.get('industry') as string) || undefined,
      isActive: (data.get('isActive') as string) === 'true',
    }

    const validated = CreateBrandSchema.safeParse(rawData)

    if (!validated.success) {
      return {
        success: false,
        error: 'Ошибка валидации',
        details: validated.error.flatten().fieldErrors,
      }
    }

    const brand = await prisma.brand.create({
      data: {
        ...validated.data,
        user: { connect: { id: userId } },
        metadata: {
          forbiddenWords: validated.data.forbiddenWords || [],
          examples: validated.data.examples || '',
        },
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
    const brands = await prisma.brand.findMany({
      where: {
        userId,
        deletedAt: null,
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

export async function updateBrand(id: string, data: FormData, userId: string): Promise<Result<any>> {
  try {
    const rawData = {
      name: data.get('name') as string,
      description: (data.get('description') as string) || undefined,
      tone: data.get('tone') as string,
      voice: (data.get('voice') as string) || undefined,
      colors: JSON.parse((data.get('colors') as string) || '[]'),
      forbiddenWords: JSON.parse((data.get('forbiddenWords') as string) || '[]'),
      examples: (data.get('examples') as string) || undefined,
      website: (data.get('website') as string) || undefined,
      industry: (data.get('industry') as string) || undefined,
      isActive: (data.get('isActive') as string) === 'true',
    }

    const validated = UpdateBrandSchema.safeParse({ ...rawData, id })

    if (!validated.success) {
      return {
        success: false,
        error: 'Ошибка валидации',
        details: validated.error.flatten().fieldErrors,
      }
    }

    const brand = await prisma.brand.update({
      where: {
        id,
        userId,
        deletedAt: null,
      },
      data: {
        ...validated.data,
        metadata: {
          forbiddenWords: (validated.data as any).forbiddenWords || [],
          examples: (validated.data as any).examples || '',
        },
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
    const brand = await prisma.brand.update({
      where: {
        id,
        userId,
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
