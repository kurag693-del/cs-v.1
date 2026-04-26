import { z } from "zod";

const maxNameLength = 50;
const maxToneLength = 50;
const maxRuleLength = 100;
const maxTemplateLength = 2000;
const maxExamplesLength = 2000;

export const CreateBrandSchema = z.object({
  name: z
    .string()
    .min(2, "Минимум 2 символа")
    .max(maxNameLength, `Название бренда не должно превышать ${maxNameLength} символов`),
  tone: z
    .string()
    .max(maxToneLength, `Тон не должен превышать ${maxToneLength} символов`)
    .optional(),
  vocabularyRules: z
    .array(
      z
        .string()
        .min(1, "Правило словаря не может быть пустым")
        .max(maxRuleLength, `Правило словаря не должно превышать ${maxRuleLength} символов`)
    )
    .optional(),
  forbiddenWords: z
    .array(
      z
        .string()
        .min(1, "Запрещенное слово не может быть пустым")
        .max(maxRuleLength, `Запрещенное слово не должно превышать ${maxRuleLength} символов`)
    )
    .optional(),
  structureTemplate: z
    .string()
    .max(
      maxTemplateLength,
      `Шаблон структуры не должен превышать ${maxTemplateLength} символов`
    )
    .optional(),
  examples: z
    .string()
    .max(maxExamplesLength, `Примеры не должны превышать ${maxExamplesLength} символов`)
    .optional(),
});

export const UpdateBrandSchema = CreateBrandSchema.partial();

export type CreateBrandInput = z.infer<typeof CreateBrandSchema>;
export type UpdateBrandInput = z.infer<typeof UpdateBrandSchema>;
