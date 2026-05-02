"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Users } from "lucide-react";

import { BrandForm } from "@/components/features/BrandForm";
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

type BrandRow = {
  id: string;
  name: string;
  tone: string | null;
  voice: string | null;
  colors: string[];
  metadata: unknown;
  createdAt: Date;
};

type BrandsClientProps = {
  brands: BrandRow[];
  userId: string;
  workspaceName: string | null;
  workspaceId: string | null;
};

export function BrandsClient({ brands, userId, workspaceName, workspaceId }: BrandsClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isDeleting, startDeleting] = useTransition();
  const [openDialog, setOpenDialog] = useState(false);
  const [editingBrand, setEditingBrand] = useState<BrandRow | null>(null);

  const workspaceSettingsHref = workspaceId
    ? `/dashboard/workspace?w=${encodeURIComponent(workspaceId)}`
    : "/dashboard/workspace";

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
    const confirmed = window.confirm(`Удалить бренд «${brandName}»? Это действие затронет генерацию и черновики, связанные с брендом.`);
    if (!confirmed) return;

    startDeleting(async () => {
      const result = await deleteBrand(brandId, userId);

      if (!result.success) {
        toast({
          title: "Ошибка",
          description: result.error ?? "Не удалось удалить бренд",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Готово",
        description: "Бренд удалён",
      });
      router.refresh();
    });
  };

  const extractStringArrayFromMetadata = (metadata: unknown, key: string): string[] => {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];
    const value = (metadata as Record<string, unknown>)[key];
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  };

  const extractStringFromMetadata = (metadata: unknown, key: string): string | undefined => {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return undefined;
    const value = (metadata as Record<string, unknown>)[key];
    return typeof value === "string" ? value : undefined;
  };

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="text-[1.125rem] font-semibold tracking-[-0.02em]">Список брендов</p>
            <p className="text-sm text-muted-foreground">
              {workspaceName ? (
                <>
                  В пространстве «{workspaceName}» · брендов: {brands.length}
                </>
              ) : (
                <>Брендов: {brands.length}</>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={workspaceSettingsHref}>
                <Users className="mr-2 h-4 w-4" />
                Команда и доступ
              </Link>
            </Button>

            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
              <DialogTrigger asChild>
                <Button onClick={openCreate}>Добавить бренд</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto p-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:max-w-2xl sm:p-7">
                <DialogHeader>
                  <DialogTitle>{editingBrand ? "Редактирование бренда" : "Новый бренд"}</DialogTitle>
                  <DialogDescription>
                    {editingBrand
                      ? "Изменения сохраняются для этого бренда в вашем пространстве."
                      : "Бренд привязывается к текущему рабочему пространству. Коллеги увидят его, если у них есть доступ к этому пространству (раздел «Команда»)."}
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
                          voice: editingBrand.voice ?? "",
                          colors: editingBrand.colors ?? [],
                          forbiddenWords: extractStringArrayFromMetadata(editingBrand.metadata, "forbiddenWords"),
                          vocabularyRules: extractStringArrayFromMetadata(editingBrand.metadata, "vocabularyRules"),
                          structureTemplate: extractStringFromMetadata(editingBrand.metadata, "structureTemplate") ?? "",
                          examples: JSON.stringify(extractStringArrayFromMetadata(editingBrand.metadata, "examples")),
                        }
                      : undefined
                  }
                  onSuccess={handleFormSuccess}
                  inDialog
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {brands.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center">
            <Building2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground" aria-hidden />
            <p className="mb-1 font-medium text-foreground">Пока нет ни одного бренда</p>
            <p className="mx-auto mb-5 max-w-md text-sm text-muted-foreground">
              Создайте бренд — задаёте тон и правила, генератор и календарь начнут использовать их автоматически. Это
              отдельно от команды: коллег можно пригласить в любой момент.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="sm" onClick={openCreate}>
                Создать первый бренд
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link href="/dashboard/workspace">
                  <Users className="mr-2 h-4 w-4" />
                  Пригласить команду
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Тон</TableHead>
                <TableHead>Где использовать</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {brands.map((brand) => (
                <TableRow key={brand.id}>
                  <TableCell className="font-medium">{brand.name}</TableCell>
                  <TableCell>{brand.tone ?? "—"}</TableCell>
                  <TableCell className="max-w-[14rem] text-muted-foreground text-sm">
                    Генератор, календарь, посты с этим брендом
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button variant="outline" size="sm" onClick={() => openEdit(brand)}>
                      Изменить
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
