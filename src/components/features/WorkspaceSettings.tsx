"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { WorkspaceMemberRole } from "@prisma/client";

import type { MemberRow, WorkspaceSummary } from "@/lib/workspace/actions";
import {
  inviteWorkspaceMember,
  listWorkspaceMembers,
  removeWorkspaceMember,
  updateWorkspaceAdminDelegates,
  updateWorkspacePublishPolicy,
} from "@/lib/workspace/actions";
import { canInviteMembers, canManageMembers, canRemoveMemberRow } from "@/lib/workspace/permissions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { Switch } from "@/components/ui/switch";

const ROLE_LABELS: Record<WorkspaceMemberRole, string> = {
  OWNER: "Владелец",
  ADMIN: "Администратор",
  EDITOR: "Редактор",
  VIEWER: "Наблюдатель",
};

type WorkspaceSettingsProps = {
  workspaceId: string;
  workspaces: WorkspaceSummary[];
  initialMembers: MemberRow[];
  actorRole: WorkspaceMemberRole | null;
  currentUserId: string;
  /** Из Workspace.settings: могут ли редакторы ставить в календарь и публиковать в каналы */
  editorsCanPublish: boolean;
};

export function WorkspaceSettings({
  workspaceId,
  workspaces,
  initialMembers,
  actorRole,
  currentUserId,
  editorsCanPublish: initialEditorsCanPublish,
}: WorkspaceSettingsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [members, setMembers] = useState(initialMembers);
  const [editorsCanPublish, setEditorsCanPublish] = useState(initialEditorsCanPublish);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "EDITOR" | "VIEWER">("EDITOR");
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const canInvite = actorRole != null && canInviteMembers(actorRole);
  const canManagePolicy = actorRole != null && canManageMembers(actorRole);
  const isOwner = actorRole === "OWNER";
  const actorRow = members.find((m) => m.userId === currentUserId);
  const actorDelegateFull = actorRow?.delegateFullAccess ?? false;

  const refreshMembers = async () => {
    const res = await listWorkspaceMembers(workspaceId);
    if (res.success) {
      setMembers(res.members);
    }
  };

  const onInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canInvite) return;
    setPending(true);
    setLastInviteUrl(null);
    try {
      const res = await inviteWorkspaceMember({ workspaceId, email: email.trim(), role: inviteRole });
      if (!res.success) {
        toast({ title: "Не удалось пригласить", description: res.error, variant: "destructive" });
        return;
      }
      setLastInviteUrl(res.inviteUrl);
      setEmail("");
      toast({
        title: "Приглашение создано",
        description: "Скопируйте ссылку и отправьте участнику по защищённому каналу.",
      });
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  const onRemove = async (targetUserId: string) => {
    setPending(true);
    try {
      const res = await removeWorkspaceMember(workspaceId, targetUserId);
      if (!res.success) {
        toast({ title: "Ошибка", description: res.error, variant: "destructive" });
        return;
      }
      toast({ title: "Участник удалён" });
      await refreshMembers();
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  const onPublishPolicyChange = async (checked: boolean) => {
    if (!canManagePolicy) return;
    setPending(true);
    try {
      const res = await updateWorkspacePublishPolicy({
        workspaceId,
        editorsCanPublish: checked,
      });
      if (!res.success) {
        toast({ title: "Не удалось сохранить", description: res.error, variant: "destructive" });
        return;
      }
      setEditorsCanPublish(checked);
      toast({
        title: "Политика публикации обновлена",
        description: checked
          ? "Редакторы могут планировать и публиковать в подключённые каналы."
          : "Редакторы работают с черновиками и согласованием; публикацию выполняют владелец или администратор.",
      });
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  const onDelegateChange = async (
    targetUserId: string,
    field: "delegateBilling" | "delegateFullAccess",
    checked: boolean
  ) => {
    const row = members.find((m) => m.userId === targetUserId);
    if (!row || row.role !== "ADMIN") return;
    setPending(true);
    try {
      const res = await updateWorkspaceAdminDelegates({
        workspaceId,
        targetUserId,
        delegateBilling: field === "delegateBilling" ? checked : row.delegateBilling,
        delegateFullAccess: field === "delegateFullAccess" ? checked : row.delegateFullAccess,
      });
      if (!res.success) {
        toast({ title: "Ошибка", description: res.error, variant: "destructive" });
        return;
      }
      toast({ title: "Сохранено" });
      await refreshMembers();
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Пространство</CardTitle>
          <CardDescription>
            Команда и бренды объединяются в рабочем пространстве. Переключатель ниже влияет на список участников.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {workspaces.map((w) => (
            <Button key={w.id} variant={w.id === workspaceId ? "default" : "outline"} size="sm" asChild>
              <Link href={`/dashboard/workspace?w=${encodeURIComponent(w.id)}`}>{w.name}</Link>
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Публикация в каналы</CardTitle>
          <CardDescription>
            Кто может ставить посты в календарь и отправлять их в Telegram, VK и Дзен для брендов этого пространства.
            Наблюдатели не публикуют никогда. Владелец и администратор всегда могут.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <Label htmlFor="editor-publish" className="text-sm font-medium">
                Редакторы могут планировать и публиковать
              </Label>
              <p className="text-muted-foreground text-xs leading-snug">
                Если выключено, редакторы сохраняют черновики и проходят согласование; в календарь и в каналы выкладывают
                владелец или администратор.
              </p>
            </div>
            <Switch
              id="editor-publish"
              checked={editorsCanPublish}
              onCheckedChange={(v) => void onPublishPolicyChange(v)}
              disabled={pending || !canManagePolicy}
              aria-label="Редакторы могут планировать и публиковать"
            />
          </div>
          {!canManagePolicy ? (
            <p className="text-muted-foreground text-xs">
              Изменить могут только владелец и администратор. Текущее значение:{" "}
              {editorsCanPublish ? "редакторы могут публиковать" : "только админы и владелец"}.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {canInvite ? (
        <Card>
          <CardHeader>
            <CardTitle>Пригласить участника</CardTitle>
            <CardDescription>
              Одноразовая ссылка со сроком действия 48 часов. Email участника должен совпадать с аккаунтом при
              принятии.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onInvite} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="grid flex-1 gap-2 sm:min-w-56">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="colleague@company.ru"
                  required
                  disabled={pending}
                />
              </div>
              <div className="grid gap-2 sm:w-44">
                <Label>Роль</Label>
                <Select
                  value={inviteRole}
                  onValueChange={(v) => setInviteRole(v as "ADMIN" | "EDITOR" | "VIEWER")}
                  disabled={pending}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Администратор</SelectItem>
                    <SelectItem value="EDITOR">Редактор</SelectItem>
                    <SelectItem value="VIEWER">Наблюдатель</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={pending}>
                Создать ссылку-приглашение
              </Button>
            </form>
            {lastInviteUrl ? (
              <Alert className="mt-4">
                <AlertTitle>Ссылка</AlertTitle>
                <AlertDescription className="break-all font-mono text-xs">{lastInviteUrl}</AlertDescription>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => void navigator.clipboard.writeText(lastInviteUrl)}
                >
                  Копировать
                </Button>
              </Alert>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Alert>
          <AlertTitle>Просмотр</AlertTitle>
          <AlertDescription>Только владелец и администраторы могут отправлять приглашения.</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Участники</CardTitle>
          <CardDescription>Роли и делегирование для администраторов (задаёт владелец).</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Пользователь</TableHead>
                <TableHead>Роль</TableHead>
                <TableHead className="hidden md:table-cell">Делегирование</TableHead>
                <TableHead className="w-24 text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.userId}>
                  <TableCell>
                    <div className="font-medium">{m.name ?? "—"}</div>
                    <div className="text-muted-foreground text-xs">{m.email}</div>
                  </TableCell>
                  <TableCell>{ROLE_LABELS[m.role]}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {m.role === "ADMIN" && isOwner ? (
                      <div className="flex flex-col gap-2">
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={m.delegateBilling}
                            disabled={pending}
                            onCheckedChange={(v) =>
                              void onDelegateChange(m.userId, "delegateBilling", v === true)
                            }
                          />
                          Биллинг и тарифы
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={m.delegateFullAccess}
                            disabled={pending}
                            onCheckedChange={(v) =>
                              void onDelegateChange(m.userId, "delegateFullAccess", v === true)
                            }
                          />
                          Полный доступ (как у владельца, кроме смены владельца)
                        </label>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {actorRole != null &&
                    canRemoveMemberRow(actorRole, actorDelegateFull, m.role) &&
                    m.userId !== currentUserId ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        disabled={pending}
                        onClick={() => void onRemove(m.userId)}
                      >
                        Удалить
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
