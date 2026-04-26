"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";

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
import { Card, CardContent } from "@/components/ui/card";

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

export function BrandsClient({ brands, userId }: BrandsClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isDeleting, startDeleting] = useTransition();
  const [openDialog, setOpenDialog] = useState(false);
  const [editingBrand, setEditingBrand] = useState<BrandRow | null>(null);

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
          description: result.error ?? "Не удалось удалить бренд",
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
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[1.125rem] font-semibold tracking-[-0.02em]">Рабочее пространство брендов</p>
            <p className="text-sm text-muted-foreground">Всего брендов: {brands.length}</p>
          </div>

        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>Создать бренд</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto p-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:max-w-2xl sm:p-7">
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
              inDialog
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
