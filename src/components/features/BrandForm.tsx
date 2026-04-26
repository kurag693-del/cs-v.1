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
};

const defaultValues: CreateBrandInput = {
  name: "",
  tone: "",
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
}: BrandFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const resolvedInitialValues = useMemo<CreateBrandInput>(
    () => ({
      name: initialData?.name ?? defaultValues.name,
      tone: initialData?.tone ?? defaultValues.tone,
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
      const message =
        result.error?.message ?? (mode === "edit" ? "Не удалось обновить бренд" : "Не удалось создать бренд");
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
      <CardContent>
        <Form {...form}>
          <form className="grid grid-cols-1 gap-6 md:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Название</FormLabel>
                  <FormControl>
                    <Input placeholder="Например, Creative Studio" {...field} disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage>{form.formState.errors.name?.message}</FormMessage>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tone"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Тон</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Опишите стиль и тон коммуникации"
                      className="min-h-24"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage>{form.formState.errors.tone?.message}</FormMessage>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="vocabularyRules"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vocabulary Rules</FormLabel>
                  <FormControl>
                    <TagInput
                      tags={field.value ?? []}
                      onChange={field.onChange}
                      placeholder="Добавьте правило и нажмите Enter"
                    />
                  </FormControl>
                  <FormDescription>Слова и фразы, которые бренд предпочитает использовать</FormDescription>
                  <FormMessage>{form.formState.errors.vocabularyRules?.message as string | undefined}</FormMessage>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="forbiddenWords"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Forbidden Words</FormLabel>
                  <FormControl>
                    <TagInput
                      tags={field.value ?? []}
                      onChange={field.onChange}
                      placeholder="Добавьте слово и нажмите Enter"
                    />
                  </FormControl>
                  <FormDescription>Слова, которые нельзя использовать в контенте</FormDescription>
                  <FormMessage>{form.formState.errors.forbiddenWords?.message as string | undefined}</FormMessage>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="structureTemplate"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Structure Template</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Например: Hook -> Value -> CTA"
                      className="min-h-24"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage>{form.formState.errors.structureTemplate?.message}</FormMessage>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="examples"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Examples (JSON)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='["Пример поста 1", "Пример поста 2"]'
                      className="min-h-32 font-mono text-sm"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>Можно хранить JSON-строку с примерами текстов</FormDescription>
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
      </CardContent>
    </Card>
  );
}
