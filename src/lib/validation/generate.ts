import { z } from "zod";

export const generateTextInputSchema = z.object({
  topic: z
    .string()
    .min(3, "Введите тему (минимум 3 символа)")
    .max(500, "Тема слишком длинная"),
  platform: z.enum(["Instagram", "Telegram", "VK", "TikTok"], {
    message: "Выберите платформу",
  }),
  brandId: z.string().optional(),
  maxLength: z.number().int().min(100).max(2000),
});

export type GenerateTextInput = z.infer<typeof generateTextInputSchema>;
