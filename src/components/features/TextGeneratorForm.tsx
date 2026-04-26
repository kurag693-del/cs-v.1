"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Copy, Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { generateText } from "@/lib/generate/actions";
import { saveGenerationAsDraft } from "@/lib/posts/actions";
import { generateTextInputSchema as GenerateTextInputSchema, type GenerateTextInput } from "@/lib/validation/generate";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

type BrandOption = {
  id: string;
  name: string;
};

type TextGeneratorFormProps = {
  userId: string;
  brands: BrandOption[];
};

type GenerateRequestPayload = {
  topic: string;
  platform: GenerateTextInput["platform"];
  brandId?: string;
  maxLength: number;
};

export function TextGeneratorForm({ userId, brands }: TextGeneratorFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [lastRequest, setLastRequest] = useState<GenerateRequestPayload | null>(null);

  const form = useForm<GenerateTextInput>({
    resolver: zodResolver(GenerateTextInputSchema),
    defaultValues: {
      topic: "",
      platform: "Instagram",
      brandId: undefined,
      maxLength: 800,
    },
  });

  const runGeneration = async (payload: GenerateRequestPayload) => {
    setIsGenerating(true);
    setError(null);
    setResult(null);
    setGenerationId(null);
    setLastRequest(payload);

    try {
      const response = await generateText(payload, userId);

      if (!response.success) {
        const message = response.error || "Не удалось сгенерировать текст";
        setError(message);
        toast({
          title: "Ошибка",
          description: message,
          variant: "destructive",
        });
        return;
      }

      if (!response.data) {
        setError("Пустой ответ от генератора");
        return;
      }

      setResult(response.data.content);
      setGenerationId(response.data.generationId);
      toast({
        title: "Черновик готов",
        description: `Модель: ${response.data.model}`,
      });
    } catch (caughtError: unknown) {
      const message =
        caughtError instanceof Error
          ? `Сетевая ошибка: ${caughtError.message}`
          : "Проверьте подключение и попробуйте снова";
      setError(message);
      toast({
        title: "Ошибка сети",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const onSubmit = async (values: GenerateTextInput) => {
    await runGeneration({
      topic: values.topic,
      platform: values.platform,
      brandId: values.brandId || undefined,
      maxLength: values.maxLength,
    });
  };

  const handleRetry = async () => {
    if (!lastRequest || isGenerating) return;
    await runGeneration(lastRequest);
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast({ title: "Скопировано", description: "Текст в буфере обмена" });
    } catch {
      toast({
        title: "Ошибка",
        description: "Не удалось скопировать текст",
        variant: "destructive",
      });
    }
  };

  const handleSaveDraft = async () => {
    if (!generationId) {
      toast({
        title: "Ошибка",
        description: "Сначала сгенерируйте текст",
        variant: "destructive",
      });
      return;
    }

    const currentPlatform = form.getValues("platform");

    try {
      setIsSavingDraft(true);
      const saved = await saveGenerationAsDraft(generationId, userId, currentPlatform);

      if (!saved.success) {
        toast({
          title: "Ошибка",
          description: saved.error,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Сохранено",
        description: "Черновик добавлен в календарь",
      });
      router.push("/dashboard/calendar");
      router.refresh();
    } catch (caughtError: unknown) {
      toast({
        title: "Ошибка",
        description: caughtError instanceof Error ? caughtError.message : "Не удалось сохранить черновик",
        variant: "destructive",
      });
    } finally {
      setIsSavingDraft(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Генерация текста</CardTitle>
          <CardDescription>Заполните параметры и получите AI-черновик</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="topic"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Тема</FormLabel>
                    <FormControl>
                      <Textarea
                        className="min-h-28 w-full resize-none"
                        placeholder="О чем будет ваш пост?"
                        disabled={isGenerating}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Опишите задачу конкретно: продукт, аудитория и желаемый результат поста.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="platform"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Платформа</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={isGenerating}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Instagram">Instagram</SelectItem>
                          <SelectItem value="Telegram">Telegram</SelectItem>
                          <SelectItem value="VK">VK</SelectItem>
                          <SelectItem value="TikTok">TikTok</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>От платформы зависит стиль, длина и формат текста.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="brandId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Бренд</FormLabel>
                      <Select
                        value={field.value ?? "none"}
                        onValueChange={(value) => field.onChange(value === "none" ? undefined : value)}
                        disabled={isGenerating}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Без бренда" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Без бренда</SelectItem>
                          {brands.map((brand) => (
                            <SelectItem key={brand.id} value={brand.id}>
                              {brand.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>Выберите бренд, чтобы применить его tone of voice и правила.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="maxLength"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Максимальная длина: {field.value} символов</FormLabel>
                    <FormControl>
                      <Slider
                        min={100}
                        max={2000}
                        step={10}
                        value={[field.value]}
                        onValueChange={(value: number[]) => field.onChange(value[0] ?? 800)}
                        disabled={isGenerating}
                      />
                    </FormControl>
                    <FormDescription>Рекомендуем 500-1200 символов для большинства постов.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isGenerating}>
                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isGenerating ? "ИИ создаёт черновик..." : "Сгенерировать"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Результат генерации</CardTitle>
          <CardDescription>Проверьте текст перед сохранением</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isGenerating ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">ИИ создаёт черновик...</p>
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : null}

          {!isGenerating && error ? (
            <Alert variant="destructive">
              <AlertTitle>Ошибка генерации</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
              <div className="mt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRetry}
                  disabled={isGenerating || !lastRequest}
                >
                  Повторить
                </Button>
              </div>
            </Alert>
          ) : null}

          {!isGenerating && !error && result ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Успешно сгенерировано</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="whitespace-pre-wrap text-sm">{result}</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={handleCopy}>
                    {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                    {copied ? "Скопировано" : "Копировать"}
                  </Button>
                  <Button variant="outline" onClick={handleSaveDraft} disabled={isSavingDraft}>
                    {isSavingDraft ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {isSavingDraft ? "Сохранение..." : "Сохранить как черновик"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {!isGenerating && !error && !result ? (
            <div className="rounded-lg border bg-muted/40 p-4">
              <p className="text-sm text-muted-foreground">
                Результат появится здесь после генерации.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
