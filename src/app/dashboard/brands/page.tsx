import { redirect } from "next/navigation";
import Link from "next/link";

import { BrandsClient } from "@/app/dashboard/brands/brands-client";
import { validateSession } from "@/lib/auth/lucia";
import { getBrands } from "@/lib/brands/actions";
import { ensurePersonalWorkspace, listMyWorkspaces } from "@/lib/workspace/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function BrandsPage() {
  const { user } = await validateSession();
  const userId = user?.id ?? null;
  if (!userId) {
    redirect("/login");
  }

  await ensurePersonalWorkspace(userId);

  const result = await getBrands(userId);
  const brands = result.success ? result.data ?? [] : [];

  const wsList = await listMyWorkspaces();
  const primaryWs =
    wsList.success && wsList.workspaces.length > 0
      ? wsList.workspaces.find((w) => w.isOwner) ?? wsList.workspaces[0]
      : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-xl tracking-tight">Бренды</CardTitle>
          <CardDescription className="max-w-2xl text-pretty leading-relaxed">
            Бренд — это голос и правила для генерации (тон, словарь, запреты). Все бренды живут в вашем{" "}
            <strong className="font-medium text-foreground">рабочем пространстве</strong>: его видит команда согласно
            ролям. Управление участниками — в разделе{" "}
            <Link href="/dashboard/workspace" className="font-medium text-primary underline-offset-4 hover:underline">
              Команда
            </Link>
            .
          </CardDescription>
          {primaryWs ? (
            <p className="text-muted-foreground text-sm">
              Текущее пространство: <span className="text-foreground font-medium">{primaryWs.name}</span>
              {wsList.success && wsList.workspaces.length > 1 ? (
                <>
                  {" "}
                  ·{" "}
                  <Link
                    href="/dashboard/workspace"
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    переключить
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {result.success ? null : (
            <div
              className="mb-4 flex flex-col gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-4"
              role="alert"
            >
              <p className="text-sm text-destructive">
                {typeof result.error === "string"
                  ? result.error
                  : (result.error as { message?: string } | undefined)?.message ??
                    "Не удалось загрузить бренды. Попробуйте обновить страницу."}
              </p>
              <div>
                <Button asChild size="sm" variant="outline">
                  <Link href="/dashboard/brands">Обновить</Link>
                </Button>
              </div>
            </div>
          )}
          <BrandsClient
            brands={brands}
            userId={userId}
            workspaceName={primaryWs?.name ?? null}
            workspaceId={primaryWs?.id ?? null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
