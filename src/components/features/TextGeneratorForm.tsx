"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Copy, ImageIcon, Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import type { AIProviderId } from "@/lib/ai/providers/types";

/** Для тестов: в development всегда; в prod — если NEXT_PUBLIC_SHOW_AI_SOURCE=true */
const SHOW_AI_SOURCE =
  process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_SHOW_AI_SOURCE === "true";
import { generatePostRasterImage } from "@/lib/ai/image/actions";
import { generateText } from "@/lib/generate/actions";
import { saveGenerationAsDraft } from "@/lib/posts/actions";
import { generateTextInputSchema as GenerateTextInputSchema, type GenerateTextInput } from "@/lib/validation/generate";
import { ImageUploader } from "@/components/features/ImageUploader";
import { TemplateSelector } from "@/components/features/TemplateSelector";
import { setPreferredBuiltinTemplate, toggleFavoriteBuiltinTemplate } from "@/lib/templates/actions";
import { getBuiltinTemplateById, getTemplateFormPatch, type BuiltinTemplate } from "@/lib/templates/builtin-templates";
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
import { MAX_MEDIA_FILES_PER_POST } from "@/lib/validation/media";

const AI_PROVIDER_LABELS: Record<AIProviderId, string> = {
  deepseek: "DeepSeek (с fallback на GigaChat)",
  yandexgpt: "YandexGPT",
  gigachat: "GigaChat",
};

type BrandOption = {
  id: string;
  name: string;
};

type TextGeneratorFormProps = {
  userId: string;
  brands: BrandOption[];
  /** Провайдеры с заданными ключами в env (серверный расчёт). */
  availableAiProviders: AIProviderId[];
  /** Дефолт для формы: предпочтительный из env среди доступных. */
  defaultAiProvider: AIProviderId;
  /** ?template= из URL: предзаполнение встроенного шаблона. */
  initialTemplateId?: string;
  /** Из `Profile.preferences.templatePrefs` — для избранного и порядка карточек. */
  templateFavoriteIds?: string[];
  templatePreferredId?: string | null;
  /** Загрузка файлов в S3 (иначе только ИИ/data URL). */
  allowFileUpload?: boolean;
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
  templateId?: string;
};

export function TextGeneratorForm({
  userId,
  brands,
  availableAiProviders,
  defaultAiProvider,
  initialTemplateId,
  templateFavoriteIds = [],
  templatePreferredId = null,
  allowFileUpload = false,
}: TextGeneratorFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const noAiProviders = availableAiProviders.length === 0;
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
  const [lastAiMeta, setLastAiMeta] = useState<{ provider: AIProviderId; model: string } | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<"A" | "B" | "C">("A");
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
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
      provider: defaultAiProvider,
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
      templateId: undefined,
    },
  });

  const appliedTemplateId = useWatch({ control: form.control, name: "templateId" });

  useEffect(() => {
    if (!initialTemplateId) return;
    const template = getBuiltinTemplateById(initialTemplateId);
    if (!template) return;
    const patch = getTemplateFormPatch(template);
    form.setValue("topic", patch.topic);
    form.setValue("platform", patch.platform);
    form.setValue("toneOverride", patch.toneOverride);
    form.setValue("includeEmojis", patch.includeEmojis);
    form.setValue("templateId", template.id);
    if (patch.contentType) {
      form.setValue("contentType", patch.contentType);
    }
  }, [initialTemplateId, form]);

  const applyBuiltinTemplate = (template: BuiltinTemplate) => {
    const patch = getTemplateFormPatch(template);
    form.setValue("topic", patch.topic);
    form.setValue("platform", patch.platform);
    form.setValue("toneOverride", patch.toneOverride);
    form.setValue("includeEmojis", patch.includeEmojis);
    form.setValue("templateId", template.id);
    if (patch.contentType) {
      form.setValue("contentType", patch.contentType);
    }
    toast({
      title: "Шаблон применён",
      description: `${template.name}: тема, тип контента и тон подставлены — можно править.`,
    });
  };

  const handleToggleFavoriteTemplate = async (templateId: string) => {
    const res = await toggleFavoriteBuiltinTemplate(templateId);
    if (!res.success) {
      toast({
        title: "Не удалось обновить избранное",
        description: res.error,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: res.isFavorite ? "В избранном" : "Убрано из избранного",
    });
    router.refresh();
  };

  const handleSetPreferredTemplate = async (templateId: string | null) => {
    const res = await setPreferredBuiltinTemplate(templateId);
    if (!res.success) {
      toast({
        title: "Не удалось сохранить",
        description: res.error,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: templateId ? "Основной шаблон сохранён" : "Сброшен основной шаблон",
    });
    router.refresh();
  };

  const enableAbTest = useWatch({ control: form.control, name: "enableAbTest" });
  const enableRecycle = useWatch({ control: form.control, name: "enableRecycle" });

  const runGeneration = async (payload: GenerateRequestPayload) => {
    setIsGenerating(true);
    setError(null);
    setResult(null);
    setGenerationId(null);
    setVariants([]);
    setGeneratedHashtags([]);
    setRecycledPosts([]);
    setLastAiMeta(null);
    setSelectedVariantId("A");
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
      setLastAiMeta({ provider: response.data.provider, model: response.data.model });
      setDraftTitle((current) => current || payload.topic.slice(0, 120));
      toast({
        title: "Черновик готов",
        description: SHOW_AI_SOURCE
          ? `${AI_PROVIDER_LABELS[response.data.provider]} · ${response.data.model}`
          : `Модель: ${response.data.model}`,
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
      templateId: values.templateId,
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

  const handleGeneratePostImage = async () => {
    const topic = form.getValues("topic")?.trim() ?? "";
    if (topic.length < 8) {
      toast({
        title: "Нужна тема поста",
        description: "Заполните поле «Тема» минимум 8 символов — по нему строится промпт для картинки.",
        variant: "destructive",
      });
      return;
    }
    if (mediaUrls.length >= MAX_MEDIA_FILES_PER_POST) {
      toast({
        title: "Лимит изображений",
        description: `Не более ${MAX_MEDIA_FILES_PER_POST} файлов на один пост.`,
        variant: "destructive",
      });
      return;
    }
    setIsGeneratingImage(true);
    try {
      const res = await generatePostRasterImage({
        prompt: `Иллюстрация для поста в соцсетях, без текста на картинке: ${topic}`,
      });
      if (!res.success) {
        toast({
          title: "Не удалось создать изображение",
          description: res.error.message,
          variant: "destructive",
        });
        return;
      }
      setMediaUrls((prev) => [...prev, res.data.imageUrl].slice(0, MAX_MEDIA_FILES_PER_POST));
      toast({
        title: "Изображение добавлено к посту",
        description:
          "Без отдельного файлового хранилища файл не загружается на сервер как объект S3: сохраняется строка URL или data URL в черновике и уходит в канал при публикации.",
      });
    } finally {
      setIsGeneratingImage(false);
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
        mediaUrls,
        selectedVariantId
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
          {noAiProviders ? (
            <Alert variant="destructive">
              <AlertTitle>ИИ-провайдеры не настроены</AlertTitle>
              <AlertDescription>
                Задайте хотя бы один ключ в{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">.env.local</code> (см.{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">.env.local.example</code>
                ): DeepSeek, YandexGPT или GigaChat. После сохранения файла перезапустите dev-сервер.
              </AlertDescription>
            </Alert>
          ) : null}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <TemplateSelector
                mode="form"
                selectedId={appliedTemplateId ?? null}
                onApply={applyBuiltinTemplate}
                favoriteIds={templateFavoriteIds}
                preferredTemplateId={templatePreferredId}
                onToggleFavorite={handleToggleFavoriteTemplate}
                onSetPreferred={handleSetPreferredTemplate}
                disabled={isGenerating || noAiProviders}
              />
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
                        disabled={isGenerating || noAiProviders}
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
                        disabled={isGenerating || noAiProviders}
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
                        disabled={isGenerating || noAiProviders}
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
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={isGenerating || noAiProviders}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableAiProviders.map((id) => (
                            <SelectItem key={id} value={id}>
                              {AI_PROVIDER_LABELS[id]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        В списке только провайдеры с заданными ключами в окружении сервера.
                      </FormDescription>
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
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={isGenerating || noAiProviders}
                      >
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
                      <Select value={field.value} onValueChange={field.onChange} disabled={isGenerating || noAiProviders}>
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
                        disabled={isGenerating || noAiProviders}
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
                  <FormItem className="flex flex-row items-start gap-3 space-y-0 rounded-lg border p-3">
                    <div className="min-w-0 flex-1 space-y-0.5 pr-1">
                      <FormLabel>Добавлять эмодзи</FormLabel>
                      <FormDescription>Если отключено, генератор пишет текст без эмодзи.</FormDescription>
                    </div>
                    <FormControl className="shrink-0 self-start pt-0.5">
                      <Switch
                        variant="emphasized"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isGenerating || noAiProviders}
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
                    <FormItem className="flex flex-row items-start gap-3 space-y-0 rounded-lg border p-3">
                      <div className="min-w-0 flex-1 space-y-0.5 pr-1">
                        <FormLabel>A/B варианты</FormLabel>
                        <FormDescription>
                          Рекомендуется включить, если сравниваете несколько ответов; число вариантов задаётся ниже.
                        </FormDescription>
                      </div>
                      <FormControl className="shrink-0 self-start pt-0.5">
                        <Switch variant="emphasized" checked={field.value} onCheckedChange={field.onChange} disabled={isGenerating || noAiProviders} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="autoHashtags"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start gap-3 space-y-0 rounded-lg border p-3">
                      <div className="min-w-0 flex-1 space-y-0.5 pr-1">
                        <FormLabel>Авто-хештеги</FormLabel>
                        <FormDescription>Добавляет рекомендованные хештеги под платформу.</FormDescription>
                      </div>
                      <FormControl className="shrink-0 self-start pt-0.5">
                        <Switch variant="emphasized" checked={field.value} onCheckedChange={field.onChange} disabled={isGenerating || noAiProviders} />
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
                      disabled={isGenerating || noAiProviders}
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
                  <FormItem className="flex flex-row items-start gap-3 space-y-0 rounded-lg border p-3">
                    <div className="min-w-0 flex-1 space-y-0.5 pr-1">
                        <FormLabel>Ресайклинг 1→N платформ</FormLabel>
                        <FormDescription>
                          Дублирует смысл текста с разными вступлениями и призывами под каждый канал (без отдельного
                          запроса к ИИ). Это не полная переписка под платформу — для глубокой адаптации сгенерируйте пост
                          отдельно с нужной платформой.
                        </FormDescription>
                    </div>
                    <FormControl className="shrink-0 self-start pt-0.5">
                      <Switch variant="emphasized" checked={field.value} onCheckedChange={field.onChange} disabled={isGenerating || noAiProviders} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="recycleTargets"
                render={({ field }) => {
                  const selectedTargets = field.value ?? [];
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
                                disabled={isGenerating || noAiProviders || !enableRecycle}
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

              <div className="space-y-3 rounded-lg border border-dashed border-primary/25 bg-muted/30 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">Картинка к посту (ИИ)</p>
                    <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                      Генерация без своего S3: результат — ссылка на внешний API или локальный превью (data URL), сохраняется в
                      черновике вместе с постом.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={noAiProviders || isGenerating || isGeneratingImage}
                    onClick={() => void handleGeneratePostImage()}
                  >
                    {isGeneratingImage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImageIcon className="mr-2 h-4 w-4" />}
                    {isGeneratingImage ? "Рисуем…" : "Сгенерировать"}
                  </Button>
                </div>
              </div>

              <ImageUploader
                userId={userId}
                value={mediaUrls}
                onChange={setMediaUrls}
                disabled={noAiProviders}
                allowFileUpload={allowFileUpload}
              />

              <Button type="submit" className="w-full" disabled={isGenerating || noAiProviders}>
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
                  disabled={isGenerating || noAiProviders || !lastRequest}
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
                {SHOW_AI_SOURCE && lastAiMeta ? (
                  <div className="rounded-lg border border-dashed border-primary/35 bg-muted/50 px-3 py-2 text-xs">
                    <p className="font-medium text-foreground">Источник ответа (для тестов)</p>
                    <p className="mt-1 text-muted-foreground">
                      Провайдер:{" "}
                      <span className="font-mono text-foreground">{AI_PROVIDER_LABELS[lastAiMeta.provider]}</span>{" "}
                      <span className="font-mono text-muted-foreground">({lastAiMeta.provider})</span>
                    </p>
                    <p className="text-muted-foreground">
                      Модель: <span className="font-mono text-foreground">{lastAiMeta.model}</span>
                    </p>
                  </div>
                ) : null}
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
                    <p className="text-xs text-muted-foreground">
                      Все варианты получены одним запросом к ИИ (одна генерация на счёте). Сравните и выберите; при
                      сохранении черновика в календарь уйдёт выбранный вариант.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {variants.map((variant) => (
                        <Button
                          key={variant.id}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setSelectedVariantId(variant.id);
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
