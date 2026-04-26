"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Link2,
  Play,
  RefreshCw,
  ShieldCheck,
  Signal,
} from "lucide-react";

import { BrandForm } from "@/components/features/BrandForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { deleteBrand } from "@/lib/brands/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type BrandRow = {
  id: string;
  name: string;
  tone: string | null;
  createdAt: Date;
};

type BrandsClientProps = {
  brands: BrandRow[];
  userId: string;
};

type IntegrationStatus = "connected" | "attention";

type IntegrationCard = {
  id: string;
  platform: string;
  accountLabel: string;
  status: IntegrationStatus;
  health: "Healthy" | "Degraded";
  permissions: string;
  syncState: string;
  postingLimit: string;
};

const integrations: IntegrationCard[] = [
  {
    id: "telegram",
    platform: "Telegram",
    accountLabel: "@creative_studio",
    status: "connected",
    health: "Healthy",
    permissions: "Read/Write",
    syncState: "Синхронизация 2 мин назад",
    postingLimit: "50 публикаций / день",
  },
  {
    id: "vk",
    platform: "VK",
    accountLabel: "vk.com/creativestudio",
    status: "connected",
    health: "Healthy",
    permissions: "Read/Write",
    syncState: "Синхронизация 6 мин назад",
    postingLimit: "30 публикаций / день",
  },
  {
    id: "linkedin",
    platform: "LinkedIn",
    accountLabel: "Creative Studio Company Page",
    status: "attention",
    health: "Degraded",
    permissions: "Read only",
    syncState: "Требуется повторная авторизация",
    postingLimit: "15 публикаций / день",
  },
  {
    id: "youtube",
    platform: "YouTube",
    accountLabel: "Creative Studio Channel",
    status: "connected",
    health: "Healthy",
    permissions: "Upload + Publish",
    syncState: "Синхронизация 4 мин назад",
    postingLimit: "10 видео / день",
  },
  {
    id: "dzen",
    platform: "Яндекс Дзен",
    accountLabel: "Креатив-студия",
    status: "attention",
    health: "Degraded",
    permissions: "Read/Write",
    syncState: "Sync paused: token refresh needed",
    postingLimit: "20 публикаций / день",
  },
];

export function BrandsClient({ brands, userId }: BrandsClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isDeleting, startDeleting] = useTransition();
  const [openDialog, setOpenDialog] = useState(false);
  const [editingBrand, setEditingBrand] = useState<BrandRow | null>(null);

  const connectedCount = integrations.filter((item) => item.status === "connected").length;
  const attentionCount = integrations.length - connectedCount;

  const openCreate = () => {
    setEditingBrand(null);
    setOpenDialog(true);
  };

  const openEdit = (brand: BrandRow) => {
    setEditingBrand(brand);
    setOpenDialog(true);
  };

  const handleFormSuccess = () => {
    setOpenDialog(false);
    setEditingBrand(null);
    router.refresh();
  };

  const handleDelete = (brandId: string, brandName: string) => {
    const confirmed = window.confirm(`Удалить бренд "${brandName}"?`);
    if (!confirmed) return;

    startDeleting(async () => {
      const result = await deleteBrand(brandId, userId);

      if (!result.success) {
        toast({
          title: "Ошибка",
          description: result.error?.message ?? "Не удалось удалить бренд",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Успех",
        description: "Бренд удален",
      });
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <p className="text-[0.75rem] uppercase tracking-[0.08em] text-muted-foreground">Connected</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.02em]">{connectedCount}</p>
              <p className="text-[0.8125rem] text-muted-foreground">из {integrations.length} платформ активны</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-[0.75rem] uppercase tracking-[0.08em] text-muted-foreground">Account Health</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.02em]">{attentionCount === 0 ? "Stable" : "Needs attention"}</p>
              <p className="text-[0.8125rem] text-muted-foreground">{attentionCount} требуют reconnect</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-[0.75rem] uppercase tracking-[0.08em] text-muted-foreground">Publishing Access</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.02em]">Ready</p>
              <p className="text-[0.8125rem] text-muted-foreground">очередь публикаций доступна</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {integrations.map((item) => {
            const isConnected = item.status === "connected";
            return (
              <Card key={item.id} className={cn(!isConnected && "border-destructive/30")}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base">{item.platform}</CardTitle>
                    <CardDescription className="mt-1">{item.accountLabel}</CardDescription>
                  </div>
                  <Badge variant={isConnected ? "secondary" : "outline"} className="gap-1">
                    {isConnected ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                    {isConnected ? "Connected" : "Reconnect required"}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-border bg-card p-3">
                      <p className="text-[0.75rem] uppercase tracking-[0.08em] text-muted-foreground">Health</p>
                      <p className="mt-1 inline-flex items-center gap-1.5 text-[0.875rem] font-medium">
                        <Signal className="h-3.5 w-3.5 text-primary" />
                        {item.health}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-3">
                      <p className="text-[0.75rem] uppercase tracking-[0.08em] text-muted-foreground">Permissions</p>
                      <p className="mt-1 inline-flex items-center gap-1.5 text-[0.875rem] font-medium">
                        <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                        {item.permissions}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-secondary p-3">
                    <p className="text-[0.75rem] uppercase tracking-[0.08em] text-muted-foreground">Sync state</p>
                    <p className="mt-1 text-[0.875rem]">{item.syncState}</p>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[0.8125rem] text-muted-foreground">Posting limits: {item.postingLimit}</p>
                    <Button
                      size="sm"
                      variant={isConnected ? "outline" : "default"}
                      onClick={() =>
                        toast({
                          title: isConnected ? "Проверка соединения" : "Reconnect запущен",
                          description: `${item.platform}: ${isConnected ? "соединение стабильно" : "обновите OAuth-токен"}`,
                        })
                      }
                    >
                      {isConnected ? <Link2 className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
                      {isConnected ? "Проверить" : "Reconnect"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[1.125rem] font-semibold tracking-[-0.02em]">Brand Workspace</p>
            <p className="text-sm text-muted-foreground">Всего брендов: {brands.length}</p>
          </div>

        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>Создать бренд</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{editingBrand ? "Редактирование бренда" : "Новый бренд"}</DialogTitle>
              <DialogDescription>
                {editingBrand ? "Измените поля и сохраните обновления" : "Заполните поля и сохраните бренд"}
              </DialogDescription>
            </DialogHeader>
            <BrandForm
              userId={userId}
              mode={editingBrand ? "edit" : "create"}
              brandId={editingBrand?.id}
              initialData={
                editingBrand
                  ? {
                      name: editingBrand.name,
                      tone: editingBrand.tone ?? "",
                    }
                  : undefined
              }
              onSuccess={handleFormSuccess}
            />
          </DialogContent>
        </Dialog>
      </div>

      {brands.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-secondary p-8 text-center text-sm text-muted-foreground">
          <Play className="mx-auto mb-3 h-5 w-5 text-muted-foreground" />
          <p className="mb-3">Пока нет брендов для креативного контекста</p>
          <Button size="sm" onClick={openCreate}>
            Создать первый
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Тон</TableHead>
              <TableHead>Платформы</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {brands.map((brand) => (
              <TableRow key={brand.id}>
                <TableCell className="font-medium">{brand.name}</TableCell>
                <TableCell>{brand.tone ?? "—"}</TableCell>
                <TableCell>Instagram, Telegram, VK, TikTok</TableCell>
                <TableCell className="space-x-2 text-right">
                  <Button variant="outline" size="sm" onClick={() => openEdit(brand)}>
                    Редактировать
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={isDeleting}
                    onClick={() => handleDelete(brand.id, brand.name)}
                  >
                    Удалить
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      </section>
    </div>
  );
}
