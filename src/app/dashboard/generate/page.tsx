import Link from "next/link";
import { redirect } from "next/navigation";
import { Brain, Sparkles, Wand2 } from "lucide-react";

import { TextGeneratorForm } from "@/components/features/TextGeneratorForm";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getOpenRouterImageModelOptions,
  getOpenRouterTextModelOptions,
} from "@/lib/ai/model-catalog";
import {
  getConfiguredAIProviderIds,
  pickDefaultProviderForUi,
  resolveEffectiveDefaultProvider,
} from "@/lib/ai/providers/availability";
import { resolveConfiguredDefaultProviderId } from "@/lib/ai/providers/registry";
import { validateSession } from "@/lib/auth/lucia";
import { getBrands } from "@/lib/brands/actions";
import { prisma } from "@/lib/db";
import { getBuiltinTemplatePreferences } from "@/lib/templates/actions";
import { listMyWorkspaces } from "@/lib/workspace/actions";

type GeneratePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function GeneratePage({ searchParams }: GeneratePageProps) {
  const { user } = await validateSession();
  const userId = user?.id ?? null;
  if (!userId) {
    redirect("/login");
  }

  const sp = await searchParams;
  const templateRaw = sp.template;
  const initialTemplateId =
    typeof templateRaw === "string" && templateRaw.length > 0
      ? templateRaw
      : Array.isArray(templateRaw) && typeof templateRaw[0] === "string"
        ? templateRaw[0]
        : undefined;

  const brandsResult = await getBrands(userId);
  const brands = brandsResult.success ? brandsResult.data ?? [] : [];

  const templatePrefs = await getBuiltinTemplatePreferences();
  const workspaceList = await listMyWorkspaces();
  const workspaceOptions = workspaceList.success
    ? workspaceList.workspaces.map((w) => ({ id: w.id, name: w.name, role: w.role }))
    : [];

  const availableAiProviders = getConfiguredAIProviderIds();
  const defaultAiProvider =
    pickDefaultProviderForUi(resolveConfiguredDefaultProviderId(), availableAiProviders) ??
    resolveEffectiveDefaultProvider();

  const allowFileUpload = Boolean(
    process.env.S3_BUCKET?.trim() && process.env.S3_PUBLIC_URL?.trim()
  );

  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  const subscriptionTier = subscription?.tier ?? "FREE";
  const openRouterTextModels = getOpenRouterTextModelOptions(subscriptionTier);
  const openRouterImageModels = getOpenRouterImageModelOptions(subscriptionTier);
  const imageGenIsOpenRouter =
    process.env.IMAGE_GEN_BACKEND?.trim().toLowerCase() === "openrouter";

  return (
    <div className="space-y-5">
      <Card className="border-primary/25 bg-card">
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between md:p-6">
          <div className="space-y-2">
            <Badge variant="secondary" className="w-fit">
              Генерация текста
            </Badge>
            <div>
              <p className="inline-flex items-center gap-2 text-[1.125rem] font-semibold tracking-[-0.02em]">
                <Brain className="h-4 w-4 text-primary" />
                Черновик поста
              </p>
              <p className="mt-1 max-w-xl text-[0.9375rem] text-muted-foreground leading-relaxed">
                Один запрос — готовый текст под платформу. Если выберете бренд, подставятся его тон и правила из вашего
                рабочего пространства.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 self-start sm:flex-row md:self-auto">
            <Button variant="outline" asChild>
              <Link href="/dashboard/brands">
                <Wand2 className="h-4 w-4" />
                Настроить бренды
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/workspace">Команда</Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard/calendar">
                <Sparkles className="h-4 w-4" />
                Календарь
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
          <AlertTitle>Бренды не созданы</AlertTitle>
          <AlertDescription>
            Генерация работает и без бренда. Чтобы AI использовал ваш тон и словарь, добавьте бренд в пространстве — это
            займёт пару минут. Команду можно пригласить отдельно.
          </AlertDescription>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild size="sm" variant="default">
              <Link href="/dashboard/brands">Создать бренд</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/workspace">Пригласить команду</Link>
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
          initialTemplateId={initialTemplateId}
          templateFavoriteIds={templatePrefs.favoriteIds}
          templatePreferredId={templatePrefs.preferredId}
          allowFileUpload={allowFileUpload}
          subscriptionTier={subscriptionTier}
          openRouterTextModels={openRouterTextModels}
          openRouterImageModels={openRouterImageModels}
          imageGenIsOpenRouter={imageGenIsOpenRouter}
          workspaces={workspaceOptions}
        />
      </div>
    </div>
  );
}
