"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Copy, Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { generateText } from "@/lib/generate/actions";
import { saveGenerationAsDraft } from "@/lib/posts/actions";
import { generateTextInputSchema as GenerateTextInputSchema, type GenerateTextInput } from "@/lib/validation/generate";
import { ImageUploader } from "@/components/features/ImageUploader";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
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
  provider: GenerateTextInput["provider"];
  brandId?: string;
  maxLength: number;
  contentType: GenerateTextInput["contentType"];
  toneOverride: GenerateTextInput["toneOverride"];
  includeEmojis: boolean;
  enableAbTest: boolean;
  variantsCount: 1 | 2 | 3;
  autoHashtags: boolean;
  enableRecycle: boolean;
  recycleTargets: Array<"Instagram" | "Telegram" | "VK" | "TikTok" | "Dzen">;
};

export function TextGeneratorForm({ userId, brands }: TextGeneratorFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [copied, setCopied] = useState(false);
  const [lastRequest, setLastRequest] = useState<GenerateRequestPayload | null>(null);
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [variants, setVariants] = useState<Array<{ id: "A" | "B" | "C"; label: string; content: string }>>([]);
  const [generatedHashtags, setGeneratedHashtags] = useState<string[]>([]);
  const [recycledPosts, setRecycledPosts] = useState<Array<{ platform: "Instagram" | "Telegram" | "VK" | "TikTok" | "Dzen"; content: string }>>([]);
  const recycleTargetOptions: Array<"Instagram" | "Telegram" | "VK" | "TikTok" | "Dzen"> = [
    "Instagram",
    "Telegram",
    "VK",
    "TikTok",
    "Dzen",
  ];

  const form = useForm<GenerateTextInput>({
    resolver: zodResolver(GenerateTextInputSchema),
    defaultValues: {
      topic: "",
      platform: "Instagram",
      provider: "gigachat",
      brandId: undefined,
      maxLength: 800,
      contentType: "post",
      toneOverride: "brand",
      includeEmojis: true,
      enableAbTest: false,
      variantsCount: 2,
      autoHashtags: true,
      enableRecycle: false,
      recycleTargets: [],
    },
  });

  const runGeneration = async (payload: GenerateRequestPayload) => {
    setIsGenerating(true);
    setError(null);
    setResult(null);
    setGenerationId(null);
    setVariants([]);
    setGeneratedHashtags([]);
    setRecycledPosts([]);
    setLastRequest(payload);

    try {
      const response = await generateText(payload);

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
      setVariants(response.data.variants ?? []);
      setGeneratedHashtags(response.data.hashtags ?? []);
      setRecycledPosts(response.data.recycledPosts ?? []);
      setGenerationId(response.data.generationId);
      setDraftTitle((current) => current || payload.topic.slice(0, 120));
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
      provider: values.provider,
      brandId: values.brandId || undefined,
      maxLength: values.maxLength,
      contentType: values.contentType ?? "post",
      toneOverride: values.toneOverride ?? "brand",
      includeEmojis: values.includeEmojis ?? true,
      enableAbTest: values.enableAbTest ?? false,
      variantsCount: values.variantsCount ?? 2,
      autoHashtags: values.autoHashtags ?? true,
      enableRecycle: values.enableRecycle ?? false,
      recycleTargets: values.recycleTargets ?? [],
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
    const normalizedTitle = draftTitle.trim();
    if (!normalizedTitle) {
      toast({
        title: "Ошибка",
        description: "Укажите название поста перед сохранением",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSavingDraft(true);
      const saved = await saveGenerationAsDraft(
        generationId,
        userId,
        currentPlatform,
        normalizedTitle,
        mediaUrls
      );

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

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="provider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ИИ-провайдер</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange} disabled={isGenerating}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="gigachat">GigaChat (рекомендуется)</SelectItem>
                          <SelectItem value="yandexgpt">YandexGPT (beta)</SelectItem>
                          <SelectItem value="vkai">VK AI (beta)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>Выбор влияет на стоимость, скорость и доступность генерации.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="contentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Тип контента</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange} disabled={isGenerating}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="post">📝 Универсальный пост</SelectItem>
                          <SelectItem value="story">📖 История/сторителлинг</SelectItem>
                          <SelectItem value="tips">🎯 Советы/чек-лист</SelectItem>
                          <SelectItem value="announcement">📣 Анонс/объявление</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>Формат влияет на структуру и подачу текста.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="toneOverride"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Тон сообщения</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange} disabled={isGenerating}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="brand">🧭 По голосу бренда</SelectItem>
                          <SelectItem value="humor">🎭 Юмористичный</SelectItem>
                          <SelectItem value="formal">💼 Формальный</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>Переопределяет стиль ответа, не ломая фактуру темы.</FormDescription>
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

              <FormField
                control={form.control}
                name="includeEmojis"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Добавлять эмодзи</FormLabel>
                      <FormDescription>Если отключено, генератор пишет текст без эмодзи.</FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isGenerating}
                        aria-label="Добавлять эмодзи"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="enableAbTest"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>A/B варианты</FormLabel>
                        <FormDescription>Создает несколько формулировок на одну тему.</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} disabled={isGenerating} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="autoHashtags"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Авто-хештеги</FormLabel>
                        <FormDescription>Добавляет рекомендованные хештеги под платформу.</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} disabled={isGenerating} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="variantsCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Количество вариантов</FormLabel>
                    <Select
                      value={String(field.value)}
                      onValueChange={(value) => field.onChange(Number(value) as 1 | 2 | 3)}
                      disabled={isGenerating || !form.watch("enableAbTest")}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="1">1 (без A/B)</SelectItem>
                        <SelectItem value="2">2 (A/B)</SelectItem>
                        <SelectItem value="3">3 (A/B/C)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>Рекомендуется 2 для быстрого сравнения.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="enableRecycle"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Ресайклинг 1→N платформ</FormLabel>
                      <FormDescription>Сделает адаптированные версии под выбранные каналы.</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} disabled={isGenerating} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="recycleTargets"
                render={({ field }) => {
                  const selectedTargets = field.value ?? [];
                  const recycleEnabled = form.watch("enableRecycle");
                  return (
                    <FormItem>
                      <FormLabel>Целевые платформы ресайклинга</FormLabel>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {recycleTargetOptions.map((target) => {
                          const checked = selectedTargets.includes(target);
                          return (
                            <label
                              key={target}
                              className="flex items-center gap-2 rounded-md border p-2 text-sm"
                            >
                              <Checkbox
                                checked={checked}
                                disabled={isGenerating || !recycleEnabled}
                                onCheckedChange={(nextChecked) => {
                                  const nextTargets = nextChecked
                                    ? [...selectedTargets, target]
                                    : selectedTargets.filter((item) => item !== target);
                                  field.onChange(nextTargets);
                                }}
                              />
                              {target}
                            </label>
                          );
                        })}
                      </div>
                      <FormDescription>Выберите минимум 1 платформу, если ресайклинг включен.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <ImageUploader
                userId={userId}
                value={mediaUrls}
                onChange={setMediaUrls}
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
                <div className="space-y-2">
                  <p className="text-sm font-medium">Название поста</p>
                  <Input
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    placeholder="Введите название поста для календаря"
                    maxLength={120}
                    disabled={isSavingDraft}
                  />
                </div>
                <p className="whitespace-pre-wrap text-sm">{result}</p>
                {variants.length > 1 ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">A/B варианты</p>
                    <div className="flex flex-wrap gap-2">
                      {variants.map((variant) => (
                        <Button
                          key={variant.id}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setResult(variant.content);
                            setDraftTitle((current) => current || `${variant.label}: ${form.getValues("topic").slice(0, 90)}`);
                          }}
                        >
                          {variant.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {generatedHashtags.length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Рекомендованные хештеги</p>
                    <p className="text-sm text-muted-foreground">{generatedHashtags.join(" ")}</p>
                  </div>
                ) : null}
                {recycledPosts.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Ресайклинг 1→N</p>
                    <div className="space-y-2">
                      {recycledPosts.map((item) => (
                        <div key={item.platform} className="rounded-md border p-2">
                          <p className="text-xs font-medium text-muted-foreground">{item.platform}</p>
                          <p className="mt-1 whitespace-pre-wrap text-sm">{item.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
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
