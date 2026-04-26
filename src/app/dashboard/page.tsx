import { Suspense } from "react";
import { cookies } from "next/headers";
import Link from "next/link";
import { AlertCircle, CalendarDays, Sparkles, Wand2 } from "lucide-react";

import { getDashboardStats } from "@/lib/analytics/actions";
import { prisma } from "@/lib/db/prisma";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

async function getUserIdFromAuthCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("sb-access-token")?.value;
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8")) as { sub?: string };
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

function StatsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-8 w-16" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-8 w-16" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-8 w-16" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

async function DashboardStatsSection({ userId }: { userId: string }) {
  const statsResult = await getDashboardStats(userId);

  if (!statsResult.success) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Ошибка загрузки аналитики</AlertTitle>
        <AlertDescription>{statsResult.error.message}</AlertDescription>
      </Alert>
    );
  }

  const { postsCount, creditsUsed, topPlatform } = statsResult.data;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Черновики и отложенные посты за 7 дней</CardDescription>
            <CardTitle className="text-3xl">{postsCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {postsCount === 0
                ? "Пока нет активных постов. Создайте первый черновик в генераторе."
                : "Контент-план активен, не забудьте проверить календарь."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Списано кредитов в текущем месяце</CardDescription>
            <CardTitle className="text-3xl">{creditsUsed}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {creditsUsed === 0
                ? "Кредиты еще не расходовались. Попробуйте сгенерировать первый текст."
                : "Следите за лимитом генераций, чтобы не остановить публикации."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Топ-платформа за 30 дней</CardDescription>
            <CardTitle className="text-3xl">{topPlatform ?? "—"}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {topPlatform
                ? "Эта платформа сейчас дает наибольшую плотность контента."
                : "Нет данных по платформам. Опубликуйте несколько постов для аналитики."}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const userId = await getUserIdFromAuthCookie();
  const user = userId
    ? await prisma.user.findFirst({
        where: { id: userId, deletedAt: null },
        select: { id: true, email: true },
      })
    : null;

  if (!user) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Сессия не найдена</AlertTitle>
        <AlertDescription>Войдите заново, чтобы увидеть дашборд.</AlertDescription>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Профиль сессии</CardTitle>
            <CardDescription>Текущий аккаунт для аналитики и генерации.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Email</p>
            <p className="mt-1 text-base font-medium">{user.email}</p>
          </CardContent>
        </Card>
      </section>

      <Suspense fallback={<StatsSkeleton />}>
        <DashboardStatsSection userId={user.id} />
      </Suspense>
    </div>
  );
}
