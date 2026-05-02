import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";

import { WorkspaceSettings } from "@/components/features/WorkspaceSettings";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { validateSession } from "@/lib/auth/lucia";
import {
  ensurePersonalWorkspace,
  getWorkspacePublishFlags,
  listMyWorkspaces,
  listWorkspaceMembers,
} from "@/lib/workspace/actions";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function WorkspacePage({ searchParams }: PageProps) {
  const { user } = await validateSession();
  if (!user) {
    redirect("/login");
  }

  await ensurePersonalWorkspace(user.id);

  const list = await listMyWorkspaces();
  if (!list.success) {
    return (
      <div className="space-y-4 p-4">
        <p className="text-sm text-muted-foreground">Не удалось загрузить пространства.</p>
        <Button asChild variant="outline">
          <Link href="/dashboard">На главную</Link>
        </Button>
      </div>
    );
  }

  if (list.workspaces.length === 0) {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground">Пространство не найдено.</p>
      </div>
    );
  }

  const sp = await searchParams;
  const wRaw = sp.w;
  const wParam = typeof wRaw === "string" ? wRaw : Array.isArray(wRaw) ? wRaw[0] : undefined;
  const workspaceId =
    wParam && list.workspaces.some((x) => x.id === wParam) ? wParam : list.workspaces[0]!.id;

  const membersRes = await listWorkspaceMembers(workspaceId);
  if (!membersRes.success) {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground">{membersRes.error}</p>
      </div>
    );
  }

  const primaryName = list.workspaces.find((x) => x.id === workspaceId)?.name ?? "";

  const publishFlags = await getWorkspacePublishFlags(workspaceId);
  const editorsCanPublish = publishFlags.success ? publishFlags.editorsCanPublish : true;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Команда и пространство</h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          <strong className="font-medium text-foreground">Рабочее пространство</strong> объединяет людей и{" "}
          <strong className="font-medium text-foreground">бренды</strong> (голос для генерации). Приглашение — одноразовая
          ссылка на 48 часов; войти нужно под тем же email, что указан в приглашении.
        </p>
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="text-sm">
            <span className="text-muted-foreground">Сейчас:</span>{" "}
            <span className="font-medium text-foreground">{primaryName || "Пространство"}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/brands">
                Бренды в этом пространстве
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/generate">
                <Sparkles className="mr-2 h-4 w-4" />
                Генератор
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <WorkspaceSettings
        workspaceId={workspaceId}
        workspaces={list.workspaces}
        initialMembers={membersRes.members}
        actorRole={membersRes.actorRole}
        currentUserId={user.id}
        editorsCanPublish={editorsCanPublish}
      />
    </div>
  );
}
