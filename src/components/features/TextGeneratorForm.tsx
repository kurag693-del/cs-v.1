"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Copy, ImageIcon, Loader2, Save, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { createPost } from "@/lib/posts/actions";
import { generateText } from "@/lib/generate/actions";
import { generateTextInputSchema, type GenerateTextInput } from "@/lib/validation/generate";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ContextualAiSuggestion } from "@/components/ui/contextual-ai-suggestion";

type BrandOption = {
  id: string;
  name: string;
};

type TextGeneratorFormProps = {
  userId: string;
  brands: BrandOption[];
};

type ParsedResult = {
  hook: string;
  body: string;
  hashtags: string[];
  cta: string;
  rawText: string;
};

type GenerateRequestPayload = {
  topic: string;
  platform: GenerateTextInput["platform"];
  brandId?: string;
  maxLength: number;
};

function parseGeneratedText(text: string): ParsedResult {
  const parts = text.split("\n\n");
  const hook = parts[0] ?? "";
  const body = parts[1] ?? "";
  const hashtags = (parts[2] ?? "")
    .split(" ")
    .map((item) => item.trim())
    .filter((item) => item.startsWith("#"));
  const cta = parts[3] ?? "";

  return { hook, body, hashtags, cta, rawText: text };
}

function mapPlatformToPost(platform: GenerateTextInput["platform"]): "INSTAGRAM" | "TIKTOK" {
  return platform === "TikTok" ? "TIKTOK" : "INSTAGRAM";
}

export function TextGeneratorForm({ userId, brands }: TextGeneratorFormProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ParsedResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [audience, setAudience] = useState("");
  const [contentGoal, setContentGoal] = useState("");
  const [toneOfVoice, setToneOfVoice] = useState("");
  const [manualCta, setManualCta] = useState("");
  const [contentFormat, setContentFormat] = useState<"Post" | "Reel" | "Carousel" | "Story">("Post");
  const [generationPhase, setGenerationPhase] = useState<0 | 1 | 2>(0);
  const [lastRequest, setLastRequest] = useState<GenerateRequestPayload | null>(null);

  useEffect(() => {
    if (!isGenerating) {
      setGenerationPhase(0);
      return;
    }

    const first = window.setTimeout(() => setGenerationPhase(1), 700);
    const second = window.setTimeout(() => setGenerationPhase(2), 1600);

    return () => {
      window.clearTimeout(first);
      window.clearTimeout(second);
    };
  }, [isGenerating]);

  const form = useForm<GenerateTextInput>({
    resolver: zodResolver(generateTextInputSchema),
    defaultValues: {
      topic: "",
      platform: "Instagram",
      brandId: undefined,
      maxLength: 600,
    },
  });

  const runGeneration = async (payload: GenerateRequestPayload) => {
    setIsGenerating(true);
    setError(null);
    setResult(null);
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

      setResult(parseGeneratedText(response.data.text));
      toast({
        title: "Готово",
        description: `Текст сгенерирован (${response.data.modelUsed})`,
      });
    } catch {
      const message = "Проверьте подключение и попробуйте снова";
      setError(message);
      setIsGenerating(false);
      toast({
        title: "Ошибка",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const onSubmit = async (values: GenerateTextInput) => {
    const enrichedTopic = [
      `Тема: ${values.topic}`,
      audience ? `Аудитория: ${audience}` : "",
      contentGoal ? `Цель: ${contentGoal}` : "",
      toneOfVoice ? `Tone of voice: ${toneOfVoice}` : "",
      manualCta ? `Желаемый CTA: ${manualCta}` : "",
      `Формат: ${contentFormat}`,
    ]
      .filter(Boolean)
      .join("\n");

    await runGeneration({
      topic: enrichedTopic,
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
    await navigator.clipboard.writeText(result.rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast({ title: "Скопировано", description: "Результат в буфере обмена" });
  };

  const handleSaveDraft = async () => {
    if (!result) return;

    const values = form.getValues();
    const draft = new FormData();
    draft.set("title", result.hook.slice(0, 80) || "AI Draft");
    draft.set("content", result.rawText);
    draft.set("platform", mapPlatformToPost(values.platform));
    draft.set("mediaUrls", "[]");
    draft.set("brandId", values.brandId ?? "");
    draft.set("metadata", JSON.stringify({ source: "text-generator-form" }));

    const saved = await createPost(draft, userId);
    if (!saved.success) {
      toast({
        title: "Ошибка",
        description: saved.error || "Не удалось сохранить черновик",
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Сохранено", description: "Пост добавлен в черновики" });
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
      <Card className="min-w-0 overflow-hidden rounded-3xl border-border bg-card shadow-[var(--shadow-sm)]">
        <CardHeader className="space-y-3">
          <Badge variant="secondary" className="w-fit">
            Prompt Builder
          </Badge>
          <div>
            <CardTitle>Соберите идеальный input для AI</CardTitle>
            <CardDescription className="mt-1.5">
              Минимум полей, максимум намерения. AI генерирует контент в едином креативном контексте.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="min-w-0 overflow-hidden">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="min-w-0 space-y-6">
              <FormField
                control={form.control}
                name="topic"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Тема</FormLabel>
                    <FormControl>
                      <Textarea
                        className="min-h-28 max-w-full"
                        placeholder="О чем создаем контент сегодня?"
                        disabled={isGenerating}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div className="min-w-0 space-y-2">
                    <FormLabel>Аудитория</FormLabel>
                    <Input
                      className="max-w-full"
                      value={audience}
                      onChange={(event) => setAudience(event.target.value)}
                      placeholder="Например: эксперты и creators 25-35"
                      disabled={isGenerating}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="platform"
                    render={({ field }) => (
                      <FormItem className="min-w-0">
                        <FormLabel>Платформа</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange} disabled={isGenerating}>
                          <FormControl>
                            <SelectTrigger className="max-w-full">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="border border-border bg-popover shadow-md">
                            <SelectItem value="Instagram">Instagram</SelectItem>
                            <SelectItem value="Telegram">Telegram</SelectItem>
                            <SelectItem value="VK">VK</SelectItem>
                            <SelectItem value="TikTok">TikTok</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <FormField
                    control={form.control}
                    name="brandId"
                    render={({ field }) => (
                      <FormItem className="min-w-0">
                        <FormLabel>Бренд</FormLabel>
                        <Select
                          value={field.value ?? "none"}
                          onValueChange={(value) => field.onChange(value === "none" ? undefined : value)}
                          disabled={isGenerating}
                        >
                          <FormControl>
                            <SelectTrigger className="max-w-full">
                              <SelectValue placeholder="Без бренда" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="border border-border bg-popover shadow-md">
                            <SelectItem value="none">Без бренда</SelectItem>
                            {brands.map((brand) => (
                              <SelectItem key={brand.id} value={brand.id}>
                                {brand.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="min-w-0 space-y-2">
                    <FormLabel>Цель контента</FormLabel>
                    <Input
                      className="max-w-full"
                      value={contentGoal}
                      onChange={(event) => setContentGoal(event.target.value)}
                      placeholder="Подписки, лиды, вовлеченность..."
                      disabled={isGenerating}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="min-w-0 space-y-2">
                    <FormLabel>Tone of voice</FormLabel>
                    <Input
                      className="max-w-full"
                      value={toneOfVoice}
                      onChange={(event) => setToneOfVoice(event.target.value)}
                      placeholder="Calm expert, concise, premium"
                      disabled={isGenerating}
                    />
                  </div>

                  <div className="min-w-0 space-y-2">
                    <FormLabel>CTA</FormLabel>
                    <Input
                      className="max-w-full"
                      value={manualCta}
                      onChange={(event) => setManualCta(event.target.value)}
                      placeholder="Например: Сохраните пост и поделитесь"
                      disabled={isGenerating}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="min-w-0 space-y-2">
                    <FormLabel>Формат</FormLabel>
                    <Select value={contentFormat} onValueChange={(value) => setContentFormat(value as typeof contentFormat)}>
                      <SelectTrigger className="max-w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border border-border bg-popover shadow-md">
                        <SelectItem value="Post">Post</SelectItem>
                        <SelectItem value="Reel">Reel</SelectItem>
                        <SelectItem value="Carousel">Carousel</SelectItem>
                        <SelectItem value="Story">Story</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
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
                        step={50}
                        value={[field.value]}
                        onValueChange={(value) => field.onChange(value[0] ?? 600)}
                        disabled={isGenerating}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {error ? (
                <Alert variant="destructive">
                  <AlertTitle>Ошибка генерации</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                  <div className="mt-3">
                    <Button type="button" variant="outline" size="sm" onClick={handleRetry} disabled={isGenerating || !lastRequest}>
                      Повторить
                    </Button>
                  </div>
                </Alert>
              ) : null}

              <Button type="submit" className="w-full" disabled={isGenerating}>
                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isGenerating ? "AI пишет черновик..." : "Generate Preview"}
              </Button>
              {isGenerating ? (
                <div className="rounded-xl border border-border bg-secondary px-3.5 py-3 text-[0.8125rem] text-muted-foreground motion-silent">
                  <p className="mb-2 font-medium text-foreground">ИИ думает... (~15 сек)</p>
                  {generationPhase === 0 ? "Анализируем контекст бренда и платформы..." : null}
                  {generationPhase === 1 ? "Собираем hook, структуру и CTA..." : null}
                  {generationPhase === 2 ? "Финализируем премиальный тон и подачу..." : null}
                </div>
              ) : null}
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-border bg-card shadow-[var(--shadow-sm)]">
        <CardHeader className="space-y-3">
          <Badge variant="outline" className="w-fit">
            Live Generated Preview
          </Badge>
          <div>
            <CardTitle>Preview before publishing</CardTitle>
            <CardDescription className="mt-1.5">
              Готовый контент с hook, CTA, hashtags и визуальной идеей.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isGenerating ? (
            <div className="space-y-4">
              <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-7 w-full" />
              </div>
              <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-20 w-full" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Skeleton className="h-20 w-full rounded-2xl" />
                <Skeleton className="h-20 w-full rounded-2xl" />
              </div>
              <Skeleton className="h-48 w-full rounded-2xl" />
            </div>
          ) : null}

          {!isGenerating && !result ? (
            <div className="rounded-2xl border border-border bg-secondary p-6 text-center">
              <p className="text-[0.9375rem] text-muted-foreground">
                Настройте Prompt Builder слева и запустите генерацию.
              </p>
            </div>
          ) : null}

          {result ? (
            <>
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="mb-1 text-[0.75rem] uppercase tracking-[0.08em] text-muted-foreground">Hook</p>
                <p className="text-[0.9375rem] font-medium">{result.hook}</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="mb-1 text-[0.75rem] uppercase tracking-[0.08em] text-muted-foreground">Generated content</p>
                <p className="whitespace-pre-wrap text-[0.9375rem]">{result.body}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="mb-1 text-[0.75rem] uppercase tracking-[0.08em] text-muted-foreground">CTA</p>
                  <p className="text-[0.9375rem]">{result.cta || manualCta || "—"}</p>
                </div>
                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="mb-1 text-[0.75rem] uppercase tracking-[0.08em] text-muted-foreground">Hashtags</p>
                  <p className="text-[0.9375rem]">{result.hashtags.join(" ") || "—"}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="mb-1 text-[0.75rem] uppercase tracking-[0.08em] text-muted-foreground">Visual concept</p>
                <p className="inline-flex items-center gap-2 text-[0.9375rem] text-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  {contentFormat} concept for {form.getValues("platform")} with{" "}
                  {toneOfVoice ? `${toneOfVoice} tone` : "clean premium style"}.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-secondary p-4">
                <p className="mb-3 text-[0.75rem] uppercase tracking-[0.08em] text-muted-foreground">Generated image preview</p>
                <div className="flex aspect-[16/9] items-center justify-center rounded-xl border border-border bg-card">
                  <div className="text-center">
                    <ImageIcon className="mx-auto h-6 w-6 text-muted-foreground" />
                    <p className="mt-2 text-[0.8125rem] text-muted-foreground">AI visual preview placeholder</p>
                  </div>
                </div>
              </div>

              <ContextualAiSuggestion
                text={`Этот пост может лучше зайти в ${form.getValues("platform")} вечером, особенно в формате ${contentFormat}.`}
              />

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={handleCopy}>
                  {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                  {copied ? "Скопировано" : "Копировать"}
                </Button>
                <Button variant="outline" onClick={handleSaveDraft}>
                  <Save className="mr-2 h-4 w-4" />
                  Сохранить как черновик
                </Button>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
