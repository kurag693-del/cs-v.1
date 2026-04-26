"use client";

import { useState } from "react";
import { Check, Copy, Loader2, RefreshCcw, Save } from "lucide-react";

import { generateText } from "@/lib/generate/actions";
import { createPost } from "@/lib/posts/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

type Platform = "Instagram" | "Telegram" | "VK" | "TikTok";

type TextGeneratorProps = {
  userId: string;
  availableBrands: Array<{ id: string; name: string }>;
};

type ParsedResult = {
  hook: string;
  body: string;
  hashtags: string[];
  cta: string;
  rawText: string;
};

function parseGeneratedText(text: string): ParsedResult {
  const chunks = text.split("\n\n");
  const hook = chunks[0] ?? "";
  const body = chunks[1] ?? "";
  const hashtags = (chunks[2] ?? "")
    .split(" ")
    .map((item) => item.trim())
    .filter((item) => item.startsWith("#"));
  const cta = chunks[3] ?? "";

  return { hook, body, hashtags, cta, rawText: text };
}

function mapPlatformToPost(platform: Platform): "INSTAGRAM" | "TIKTOK" {
  return platform === "TikTok" ? "TIKTOK" : "INSTAGRAM";
}

export function TextGenerator({ userId, availableBrands }: TextGeneratorProps) {
  const { toast } = useToast();
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState<Platform>("Instagram");
  const [brandId, setBrandId] = useState<string>("none");
  const [maxLength, setMaxLength] = useState<number[]>([600]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ParsedResult | null>(null);

  const runGeneration = async () => {
    if (!topic.trim()) {
      setError("Введите тему поста");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const response = await generateText(
      {
        topic: topic.trim(),
        platform,
        brandId: brandId === "none" ? undefined : brandId,
        maxLength: maxLength[0],
      },
      userId
    );

    if (!response.success) {
      const message = response.error || "Не удалось сгенерировать текст";
      setError(message);
      toast({
        title: "Ошибка генерации",
        description: message,
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    setResult(parseGeneratedText(response.data.text));
    toast({
      title: "Готово",
      description: `Модель: ${response.data.modelUsed}`,
    });
    setIsSubmitting(false);
  };

  const copyResult = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast({ title: "Скопировано", description: "Текст сохранен в буфер" });
  };

  const saveAsDraft = async () => {
    if (!result) return;

    const formData = new FormData();
    formData.set("title", result.hook.slice(0, 80) || "Черновик поста");
    formData.set("content", result.rawText);
    formData.set("platform", mapPlatformToPost(platform));
    formData.set("mediaUrls", "[]");
    formData.set("brandId", brandId === "none" ? "" : brandId);
    formData.set("metadata", JSON.stringify({ source: "text-generator-ui" }));

    const saved = await createPost(formData, userId);
    if (!saved.success) {
      toast({
        title: "Не удалось сохранить",
        description: saved.error || "Ошибка сохранения черновика",
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Сохранено", description: "Пост сохранен как черновик" });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Генерация поста</CardTitle>
          <CardDescription>Заполните параметры и получите готовый текст</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-medium">Тема</p>
            <Textarea
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="О чем будет пост?"
              className="min-h-28"
              disabled={isSubmitting}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">Платформа</p>
              <Select value={platform} onValueChange={(value) => setPlatform(value as Platform)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Instagram">Instagram</SelectItem>
                  <SelectItem value="Telegram">Telegram</SelectItem>
                  <SelectItem value="VK">VK</SelectItem>
                  <SelectItem value="TikTok">TikTok</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Бренд</p>
              <Select value={brandId} onValueChange={setBrandId}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите бренд" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Без бренда</SelectItem>
                  {availableBrands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">Макс. длина: {maxLength[0]} символов</p>
            <Slider
              value={maxLength}
              min={120}
              max={2000}
              step={20}
              onValueChange={setMaxLength}
              disabled={isSubmitting}
            />
          </div>

          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="w-full" onClick={runGeneration} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isSubmitting ? "Генерация..." : "Сгенерировать"}
            </Button>
            {error ? (
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={runGeneration}
                disabled={isSubmitting}
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                Повторить
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Результат</CardTitle>
          <CardDescription>Проверьте текст перед публикацией</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!result ? (
            <p className="text-sm text-muted-foreground">
              Здесь появятся хук, основная часть, хештеги и CTA после генерации.
            </p>
          ) : (
            <>
              <div className="space-y-1 rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Hook</p>
                <p className="text-sm font-medium">{result.hook}</p>
              </div>

              <div className="space-y-1 rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Body</p>
                <p className="whitespace-pre-wrap text-sm">{result.body}</p>
              </div>

              <div className="space-y-1 rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Hashtags</p>
                <p className="text-sm">{result.hashtags.join(" ") || "—"}</p>
              </div>

              <div className="space-y-1 rounded-md border p-3">
                <p className="text-xs text-muted-foreground">CTA</p>
                <p className="text-sm">{result.cta || "—"}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={copyResult}>
                  {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                  {copied ? "Скопировано" : "Копировать"}
                </Button>
                <Button variant="outline" onClick={saveAsDraft}>
                  <Save className="mr-2 h-4 w-4" />
                  Сохранить как черновик
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
