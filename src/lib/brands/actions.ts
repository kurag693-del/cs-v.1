"use server";

import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import {
  CreateBrandSchema,
  type CreateBrandInput,
  UpdateBrandSchema,
  type UpdateBrandInput,
} from "@/lib/validation/brand";

type ActionError = {
  code: string;
  message: string;
};

type ActionResult<T> = {
  success: boolean;
  data?: T;
  error?: ActionError;
};

const idSchema = z.string().min(1, "Идентификатор обязателен");

function toActionError(code: string, message: string): ActionError {
  return { code, message };
}

export async function createBrand(
  input: CreateBrandInput,
  userId: string
): Promise<ActionResult<{ id: string; name: string; tone: string | null }>> {
  try {
    const parsedInput = CreateBrandSchema.safeParse(input);
    const parsedUserId = idSchema.safeParse(userId);

    if (!parsedInput.success) {
      return {
        success: false,
        error: toActionError(
          "VALIDATION_ERROR",
          parsedInput.error.issues[0]?.message ?? "Некорректные данные бренда"
        ),
      };
    }

    if (!parsedUserId.success) {
      return {
        success: false,
        error: toActionError(
          "VALIDATION_ERROR",
          parsedUserId.error.issues[0]?.message ?? "Некорректный userId"
        ),
      };
    }

    const existingBrand = await prisma.brand.findFirst({
      where: {
        userId: parsedUserId.data,
        name: parsedInput.data.name,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (existingBrand) {
      return {
        success: false,
        error: toActionError("BRAND_ALREADY_EXISTS", "Бренд с таким названием уже существует"),
      };
    }

    const createdBrand = await prisma.brand.create({
      data: {
        userId: parsedUserId.data,
        name: parsedInput.data.name,
        tone: parsedInput.data.tone ?? null,
      },
      select: {
        id: true,
        name: true,
        tone: true,
      },
    });

    return {
      success: true,
      data: createdBrand,
    };
  } catch (error: unknown) {
    console.error("createBrand error:", error);
    return {
      success: false,
      error: toActionError("INTERNAL_ERROR", "Не удалось создать бренд"),
    };
  }
}

export async function getBrands(
  userId: string
): Promise<
  ActionResult<Array<{ id: string; name: string; tone: string | null; createdAt: Date }>>
> {
  try {
    const parsedUserId = idSchema.safeParse(userId);

    if (!parsedUserId.success) {
      return {
        success: false,
        error: toActionError(
          "VALIDATION_ERROR",
          parsedUserId.error.issues[0]?.message ?? "Некорректный userId"
        ),
      };
    }

    const brands = await prisma.brand.findMany({
      where: {
        userId: parsedUserId.data,
        deletedAt: null,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        name: true,
        tone: true,
        createdAt: true,
      },
    });

    return {
      success: true,
      data: brands,
    };
  } catch (error: unknown) {
    console.error("getBrands error:", error);
    return {
      success: false,
      error: toActionError("INTERNAL_ERROR", "Не удалось получить список брендов"),
    };
  }
}

export async function updateBrand(
  brandId: string,
  input: UpdateBrandInput,
  userId: string
): Promise<ActionResult<{ id: string; name: string; tone: string | null; updatedAt: Date }>> {
  try {
    const parsedBrandId = idSchema.safeParse(brandId);
    const parsedUserId = idSchema.safeParse(userId);
    const parsedInput = UpdateBrandSchema.safeParse(input);

    if (!parsedBrandId.success || !parsedUserId.success) {
      return {
        success: false,
        error: toActionError("VALIDATION_ERROR", "Некорректный идентификатор"),
      };
    }

    if (!parsedInput.success) {
      return {
        success: false,
        error: toActionError(
          "VALIDATION_ERROR",
          parsedInput.error.issues[0]?.message ?? "Некорректные данные бренда"
        ),
      };
    }

    const existingBrand = await prisma.brand.findFirst({
      where: {
        id: parsedBrandId.data,
        userId: parsedUserId.data,
        deletedAt: null,
      },
      select: { id: true, name: true },
    });

    if (!existingBrand) {
      return {
        success: false,
        error: toActionError("NOT_FOUND", "Бренд не найден или доступ запрещен"),
      };
    }

    if (parsedInput.data.name && parsedInput.data.name !== existingBrand.name) {
      const duplicate = await prisma.brand.findFirst({
        where: {
          userId: parsedUserId.data,
          name: parsedInput.data.name,
          deletedAt: null,
          id: { not: parsedBrandId.data },
        },
        select: { id: true },
      });

      if (duplicate) {
        return {
          success: false,
          error: toActionError("BRAND_ALREADY_EXISTS", "Бренд с таким названием уже существует"),
        };
      }
    }

    const updatedBrand = await prisma.brand.update({
      where: { id: parsedBrandId.data },
      data: {
        ...(parsedInput.data.name !== undefined ? { name: parsedInput.data.name } : {}),
        ...(parsedInput.data.tone !== undefined ? { tone: parsedInput.data.tone } : {}),
      },
      select: {
        id: true,
        name: true,
        tone: true,
        updatedAt: true,
      },
    });

    return {
      success: true,
      data: updatedBrand,
    };
  } catch (error: unknown) {
    console.error("updateBrand error:", error);
    return {
      success: false,
      error: toActionError("INTERNAL_ERROR", "Не удалось обновить бренд"),
    };
  }
}

export async function deleteBrand(
  brandId: string,
  userId: string
): Promise<ActionResult<{ id: string; deletedAt: Date }>> {
  try {
    const parsedBrandId = idSchema.safeParse(brandId);
    const parsedUserId = idSchema.safeParse(userId);

    if (!parsedBrandId.success || !parsedUserId.success) {
      return {
        success: false,
        error: toActionError("VALIDATION_ERROR", "Некорректный идентификатор"),
      };
    }

    const existingBrand = await prisma.brand.findFirst({
      where: {
        id: parsedBrandId.data,
        userId: parsedUserId.data,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!existingBrand) {
      return {
        success: false,
        error: toActionError("NOT_FOUND", "Бренд не найден или доступ запрещен"),
      };
    }

    const deletedAt = new Date();
    const deletedBrand = await prisma.brand.update({
      where: { id: parsedBrandId.data },
      data: { deletedAt },
      select: {
        id: true,
        deletedAt: true,
      },
    });

    return {
      success: true,
      data: deletedBrand as { id: string; deletedAt: Date },
    };
  } catch (error: unknown) {
    console.error("deleteBrand error:", error);
    return {
      success: false,
      error: toActionError("INTERNAL_ERROR", "Не удалось удалить бренд"),
    };
  }
}
