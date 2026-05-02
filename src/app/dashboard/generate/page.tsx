import Link from "next/link";
import { redirect } from "next/navigation";
import { Brain, Sparkles, Wand2 } from "lucide-react";

import { TextGeneratorForm } from "@/components/features/TextGeneratorForm";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getConfiguredAIProviderIds,
  pickDefaultProviderForUi,
  resolveEffectiveDefaultProvider,
} from "@/lib/ai/providers/availability";
import { resolveConfiguredDefaultProviderId } from "@/lib/ai/providers/registry";
import { validateSession } from "@/lib/auth/lucia";
import { getBrands } from "@/lib/brands/actions";

export default async function GeneratePage() {
  const { user } = await validateSession();
  const userId = user?.id ?? null;
  if (!userId) {
    redirect("/login");
  }

  const brandsResult = await getBrands(userId);
  const brands = brandsResult.success ? brandsResult.data ?? [] : [];

  const availableAiProviders = getConfiguredAIProviderIds();
  const defaultAiProvider =
    pickDefaultProviderForUi(resolveConfiguredDefaultProviderId(), availableAiProviders) ??
    resolveEffectiveDefaultProvider();

  return (
    <div className="space-y-5">
      <Card className="border-primary/25 bg-card">
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between md:p-6">
          <div className="space-y-2">
            <Badge variant="secondary" className="w-fit">
              AI Assistant Context Bar
            </Badge>
            <div>
              <p className="inline-flex items-center gap-2 text-[1.125rem] font-semibold tracking-[-0.02em]">
                <Brain className="h-4 w-4 text-primary" />
                Hero Creation Session
              </p>
              <p className="mt-1 text-[0.9375rem] text-muted-foreground">
                Сфокусируйтесь на одном сильном контент-артефакте. AI адаптирует стиль под платформу и цель.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start md:self-auto">
            <Button variant="outline" asChild>
              <Link href="/dashboard/brands">
                <Wand2 className="h-4 w-4" />
                Brand Context
              </Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard/calendar">
                <Sparkles className="h-4 w-4" />
                План публикации
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {!brandsResult.success ? (
        <Alert variant="destructive">
          <AlertTitle>Ошибка загрузки брендов</AlertTitle>
          <AlertDescription>{brandsResult.error?.message ?? "Не удалось получить список брендов"}</AlertDescription>
        </Alert>
      ) : null}

      {brands.length === 0 ? (
        <Alert>
          <AlertTitle>Бренды не найдены</AlertTitle>
          <AlertDescription>Создайте бренд, чтобы генерация учитывала tone и voice.</AlertDescription>
          <div className="mt-3">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/brands">Перейти к брендам</Link>
            </Button>
          </div>
        </Alert>
      ) : null}

      <div className="rounded-3xl border border-border bg-background/70 p-2 md:p-3">
        <TextGeneratorForm
          userId={userId}
          brands={brands.map((item) => ({ id: item.id, name: item.name }))}
          availableAiProviders={availableAiProviders}
          defaultAiProvider={defaultAiProvider}
        />
      </div>
    </div>
  );
}
