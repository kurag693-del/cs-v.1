"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { createBrand, updateBrand } from "@/lib/brands/actions";
import { CreateBrandSchema, type CreateBrandInput } from "@/lib/validation/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { TagInput } from "@/components/ui/tag-input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

type BrandFormProps = {
  userId: string;
  mode?: "create" | "edit";
  brandId?: string;
  initialData?: Partial<CreateBrandInput>;
  onSuccess?: () => void;
  inDialog?: boolean;
};

const defaultValues: CreateBrandInput = {
  name: "",
  tone: "",
  voice: "",
  colors: [],
  vocabularyRules: [],
  forbiddenWords: [],
  structureTemplate: "",
  examples: "",
};

export function BrandForm({
  userId,
  mode = "create",
  brandId,
  initialData,
  onSuccess,
  inDialog = false,
}: BrandFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const resolvedInitialValues = useMemo<CreateBrandInput>(
    () => ({
      name: initialData?.name ?? defaultValues.name,
      tone: initialData?.tone ?? defaultValues.tone,
      voice: initialData?.voice ?? defaultValues.voice,
      colors: initialData?.colors ?? defaultValues.colors,
      vocabularyRules: initialData?.vocabularyRules ?? defaultValues.vocabularyRules,
      forbiddenWords: initialData?.forbiddenWords ?? defaultValues.forbiddenWords,
      structureTemplate: initialData?.structureTemplate ?? defaultValues.structureTemplate,
      examples: initialData?.examples ?? defaultValues.examples,
    }),
    [initialData]
  );

  const form = useForm<CreateBrandInput>({
    resolver: zodResolver(CreateBrandSchema),
    defaultValues: resolvedInitialValues,
  });

  useEffect(() => {
    form.reset(resolvedInitialValues);
  }, [form, resolvedInitialValues]);

  const onSubmit = async (values: CreateBrandInput) => {
    setFormError(null);

    const result =
      mode === "edit" && brandId
        ? await updateBrand(brandId, values, userId)
        : await createBrand(values, userId);

    if (!result.success) {
      const message = result.error ?? (mode === "edit" ? "Не удалось обновить бренд" : "Не удалось создать бренд");
      setFormError(message);
      toast({
        title: "Ошибка",
        description: message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Готово",
      description: mode === "edit" ? "Бренд успешно обновлен" : "Бренд успешно создан",
    });
    form.reset(defaultValues);
    onSuccess?.();
    router.refresh();
  };

  const isSubmitting = form.formState.isSubmitting;

  const formContent = (
    <Form {...form}>
      <form
        className={inDialog ? "grid min-w-0 grid-cols-1 gap-5 md:grid-cols-2" : "grid min-w-0 grid-cols-1 gap-6 md:grid-cols-2"}
        onSubmit={form.handleSubmit(onSubmit)}
      >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="min-w-0 md:col-span-2">
                  <FormLabel>Название</FormLabel>
                  <FormControl>
                    <Input placeholder="Например, Creative Studio" {...field} disabled={isSubmitting} />
                  </FormControl>
                  <FormDescription>Короткое имя бренда, которое будет видно в генераторе и календаре.</FormDescription>
                  <FormMessage>{form.formState.errors.name?.message}</FormMessage>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tone"
              render={({ field }) => (
                <FormItem className="min-w-0 md:col-span-2">
                  <FormLabel>Тон</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Опишите стиль и тон коммуникации"
                      className="min-h-24 w-full max-w-full resize-none overflow-hidden"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    Укажите, как бренд должен звучать: например, &quot;экспертно, дружелюбно, без канцелярита&quot;.
                  </FormDescription>
                  <FormMessage>{form.formState.errors.tone?.message}</FormMessage>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="voice"
              render={({ field }) => (
                <FormItem className="min-w-0 md:col-span-2">
                  <FormLabel>Голос бренда</FormLabel>
                  <FormControl>
                    <Input placeholder="Например: экспертный, поддерживающий" {...field} disabled={isSubmitting} />
                  </FormControl>
                  <FormDescription>Кратко опишите, как бренд должен звучать в коммуникации.</FormDescription>
                  <FormMessage>{form.formState.errors.voice?.message}</FormMessage>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="colors"
              render={({ field }) => (
                <FormItem className="min-w-0 md:col-span-2">
                  <FormLabel>Фирменные цвета (HEX)</FormLabel>
                  <FormControl>
                    <TagInput
                      tags={field.value ?? []}
                      onChange={field.onChange}
                      placeholder="Например: #FF6B6B, #1A73E8"
                      className="w-full"
                    />
                  </FormControl>
                  <FormDescription>Добавьте до 5 цветов в формате HEX.</FormDescription>
                  <FormMessage>{form.formState.errors.colors?.message as string | undefined}</FormMessage>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="vocabularyRules"
              render={({ field }) => (
                <FormItem className="min-w-0">
                  <FormLabel>Предпочтительные слова</FormLabel>
                  <FormControl>
                    <TagInput
                      tags={field.value ?? []}
                      onChange={field.onChange}
                      placeholder="Например: прозрачность, забота, результат"
                      className="w-full"
                    />
                  </FormControl>
                  <FormDescription>Добавляйте слова и фразы по одному, подтверждая Enter.</FormDescription>
                  <FormMessage>{form.formState.errors.vocabularyRules?.message as string | undefined}</FormMessage>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="forbiddenWords"
              render={({ field }) => (
                <FormItem className="min-w-0">
                  <FormLabel>Запрещенные слова</FormLabel>
                  <FormControl>
                    <TagInput
                      tags={field.value ?? []}
                      onChange={field.onChange}
                      placeholder="Например: дешево, гарантировано, срочно"
                      className="w-full"
                    />
                  </FormControl>
                  <FormDescription>Эти слова модель будет избегать в текстах.</FormDescription>
                  <FormMessage>{form.formState.errors.forbiddenWords?.message as string | undefined}</FormMessage>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="structureTemplate"
              render={({ field }) => (
                <FormItem className="min-w-0 md:col-span-2">
                  <FormLabel>Шаблон структуры</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Например: Hook -> Value -> CTA"
                      className="min-h-24 w-full max-w-full resize-none overflow-hidden"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>Задайте порядок блоков в тексте: вступление, польза, призыв к действию.</FormDescription>
                  <FormMessage>{form.formState.errors.structureTemplate?.message}</FormMessage>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="examples"
              render={({ field }) => (
                <FormItem className="min-w-0 md:col-span-2">
                  <FormLabel>Примеры (JSON)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='["Пример поста 1", "Пример поста 2"]'
                      className="min-h-32 w-full max-w-full resize-none overflow-hidden font-mono text-sm"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    Необязательно. Добавьте 1-3 примера удачных текстов в формате JSON-массива.
                  </FormDescription>
                  <FormMessage>{form.formState.errors.examples?.message}</FormMessage>
                </FormItem>
              )}
            />

            {formError ? (
              <p className="md:col-span-2 text-sm text-destructive" role="alert">
                {formError}
              </p>
            ) : null}

            <Button type="submit" className="md:col-span-2 w-full" disabled={isSubmitting}>
              {isSubmitting ? "Сохранение..." : mode === "edit" ? "Сохранить изменения" : "Создать бренд"}
            </Button>
      </form>
    </Form>
  );

  if (inDialog) {
    return <div className="w-full min-w-0">{formContent}</div>;
  }

  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader>
        <CardTitle>{mode === "edit" ? "Редактирование бренда" : "Создание бренда"}</CardTitle>
        <CardDescription>
          {mode === "edit"
            ? "Обновите параметры бренда"
            : "Заполните параметры бренда для генерации контента"}
        </CardDescription>
      </CardHeader>
      <CardContent>{formContent}</CardContent>
    </Card>
  );
}
