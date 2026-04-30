"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CalendarDays, Loader2, Sparkles, Wand2 } from "lucide-react";

import { getAnalyticsSummary, getDashboardData } from "@/lib/analytics/actions";
import { useSession } from "@/lib/auth/hooks";
import { getOnboardingProgress } from "@/lib/onboarding/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ContextualAiSuggestion } from "@/components/ui/contextual-ai-suggestion";
import { generateText } from "@/lib/generate/actions";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";

function parseUserIdFromStorage(): string | null {
  if (typeof document === "undefined") return null;

  try {
    const raw = localStorage.getItem("local-auth-user");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: string };
    return parsed.id ?? null;
  } catch {
    return null;
  }
}

type DashboardData = {
  stats: {
    totalGenerations: number;
    creditsLeft: number;
    postsScheduled: number;
  };
  upcomingPosts: Array<{
    id: string;
    platform: string;
    content: string;
    scheduledAt: Date | null;
    status: string;
  }>;
  recentActivity: Array<{
    id: string;
    type: string;
    status: string;
    createdAt: Date;
    model: string;
  }>;
  connectedAccounts: Array<{
    platform: string;
    isConnected: boolean;
    note?: string;
  }>;
};

type DashboardRecommendations = {
  bestHour: string;
  bestPlatform: string;
  suggestions: string[];
};

type OnboardingBannerState = {
  completedSteps: number;
  totalSteps: number;
  isCompleted: boolean;
};

function DashboardSkeleton() {
  return (
    <section className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index}>
            <CardHeader>
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-8 w-16" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index}>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/5" />
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function EmptyState({ description }: { description: string }) {
  return (
    <div className="rounded-lg border bg-muted/40 p-4">
      <p className="text-sm text-muted-foreground">{description}</p>
      <Button asChild size="sm" className="mt-3">
        <Link href="/dashboard/generate">Создать первый пост</Link>
      </Button>
    </div>
  );
}

function formatDate(value: Date | null): string {
  if (!value) return "Дата не указана";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function DashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [topic, setTopic] = useState("");
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isGenerating, startGenerating] = useTransition();
  const [recommendations, setRecommendations] = useState<DashboardRecommendations | null>(null);
  const [onboardingState, setOnboardingState] = useState<OnboardingBannerState | null>(null);
  const { user, loading: sessionLoading } = useSession();
  const userId = useMemo(() => user?.id ?? parseUserIdFromStorage(), [user]);

  useEffect(() => {
    let isActive = true;

    const loadDashboardData = async () => {
      if (sessionLoading) {
        return;
      }
      if (!userId) {
        if (!isActive) return;
        setLoadError("Сессия не найдена. Войдите заново, чтобы увидеть дашборд.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const [result, recommendationsResult, onboardingResult] = await Promise.all([
        getDashboardData(userId),
        getAnalyticsSummary(),
        getOnboardingProgress(userId),
      ]);

      if (!isActive) return;

      if (!result.success) {
        setLoadError(result.error.message);
        setDashboardData(null);
      } else {
        setDashboardData(result.data);
        setLoadError(null);
      }

      if (recommendationsResult.success) {
        setRecommendations(recommendationsResult.data.recommendations);
      }
      if (onboardingResult.success) {
        setOnboardingState({
          completedSteps: onboardingResult.data.completedSteps,
          totalSteps: onboardingResult.data.totalSteps,
          isCompleted: onboardingResult.data.isCompleted,
        });
      }

      setIsLoading(false);
    };

    void loadDashboardData();

    return () => {
      isActive = false;
    };
  }, [userId, sessionLoading]);

  const handleQuickGeneration = () => {
    if (!userId) {
      toast({
        title: "Сессия не найдена",
        description: "Перезайдите в аккаунт и повторите попытку.",
        variant: "destructive",
      });
      return;
    }

    const trimmedTopic = topic.trim();
    if (!trimmedTopic) {
      toast({
        title: "Введите тему",
        description: "Укажите тему поста перед генерацией.",
        variant: "destructive",
      });
      return;
    }

    startGenerating(async () => {
      const result = await generateText(
        {
          type: "social_post",
          topic: trimmedTopic,
          platform: "Instagram",
        }
      );

      if (!result.success || !result.data) {
        toast({
          title: "Ошибка генерации",
          description: result.error ?? "Не удалось создать черновик",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Черновик создан",
        description: "Переходим к редактированию генерации.",
      });
      router.push(`/dashboard/generate/${result.data.generationId}`);
      router.refresh();
    });
  };

  if (loadError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Ошибка загрузки дашборда</AlertTitle>
        <AlertDescription>{loadError}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="border-primary/20">
          <CardHeader>
            <Badge variant="secondary" className="w-fit">
              Фокус дня
            </Badge>
            <CardTitle className="mt-3">Управление контентом из одного окна</CardTitle>
            <CardDescription>
              Смотрите метрики и переходите к действиям: генерация, календарь и настройка бренда.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/dashboard/generate">
                <Wand2 className="h-4 w-4" />
                Сгенерировать текст
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/calendar">
                <CalendarDays className="h-4 w-4" />
                Открыть календарь
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/brands">
                <Sparkles className="h-4 w-4" />
                Управление брендами
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/integrations">Интеграции платформ</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Быстрая генерация</CardTitle>
            <CardDescription>Создайте черновик прямо с дашборда.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="Тема поста"
              disabled={isGenerating}
              maxLength={250}
            />
            <Button onClick={handleQuickGeneration} className="w-full" disabled={isGenerating}>
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isGenerating ? "Генерируем..." : "Генерировать"}
            </Button>
          </CardContent>
        </Card>
      </section>

      {onboardingState && !onboardingState.isCompleted ? (
        <Alert>
          <Sparkles className="h-4 w-4" />
          <AlertTitle>Онбординг не завершен</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Выполнено {onboardingState.completedSteps}/{onboardingState.totalSteps}. Завершите шаги, чтобы быстрее выйти на стабильные публикации.
            </span>
            <Button asChild size="sm" variant="outline">
              <Link href="/onboarding">Открыть онбординг</Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? (
        <DashboardSkeleton />
      ) : dashboardData ? (
        <section className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardDescription>Всего генераций</CardDescription>
                <CardTitle className="text-3xl">{dashboardData.stats.totalGenerations}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Осталось кредитов</CardDescription>
                <CardTitle className="text-3xl">{dashboardData.stats.creditsLeft}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Отложенных постов</CardDescription>
                <CardTitle className="text-3xl">{dashboardData.stats.postsScheduled}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Ближайшие публикации</CardTitle>
                <CardDescription>Ближайшие 3 поста в статусе SCHEDULED.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {dashboardData.upcomingPosts.length === 0 ? (
                  <EmptyState description="Пока нет запланированных постов." />
                ) : (
                  dashboardData.upcomingPosts.map((post) => (
                    <div key={post.id} className="rounded-md border p-3">
                      <p className="text-sm font-medium">{post.platform}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{post.content}</p>
                      <p className="mt-2 text-xs text-muted-foreground">{formatDate(post.scheduledAt)}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Последняя активность</CardTitle>
                <CardDescription>Последние генерации контента.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {dashboardData.recentActivity.length === 0 ? (
                  <EmptyState description="История генераций пока пуста." />
                ) : (
                  dashboardData.recentActivity.map((activity) => (
                    <div key={activity.id} className="rounded-md border p-3">
                      <p className="text-sm font-medium">{activity.type}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {activity.status} · {activity.model}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatDate(activity.createdAt)}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Подключенные аккаунты</CardTitle>
                <CardDescription>Статус подключений платформ публикации.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {dashboardData.connectedAccounts.map((account) => (
                  <div key={account.platform} className="flex items-center justify-between rounded-md border p-2">
                    <span className="text-sm">{account.platform}</span>
                    <Badge variant={account.isConnected ? "default" : "secondary"}>
                      {account.isConnected ? "Подключено" : account.note ?? "Не подключено"}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>AI-рекомендации</CardTitle>
              <CardDescription>
                Лучшее время: {recommendations?.bestHour ?? "09:00"} · Приоритетная платформа:{" "}
                {recommendations?.bestPlatform ?? "TELEGRAM"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(recommendations?.suggestions ?? ["Наберите больше истории публикаций для персональных рекомендаций."]).map(
                (item) => (
                  <ContextualAiSuggestion key={item} text={item} />
                )
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                <Button asChild variant="outline" size="sm">
                  <a href="/api/analytics/export?format=csv">Экспорт CSV</a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href="/api/analytics/export?format=json">Экспорт JSON</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
