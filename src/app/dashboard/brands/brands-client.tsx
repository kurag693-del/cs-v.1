"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

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
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">Всего брендов: {brands.length}</p>

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
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Брендов пока нет. Нажмите "Создать бренд", чтобы добавить первый.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Tone</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {brands.map((brand) => (
              <TableRow key={brand.id}>
                <TableCell className="font-medium">{brand.name}</TableCell>
                <TableCell>{brand.tone ?? "—"}</TableCell>
                <TableCell className="space-x-2 text-right">
                  <Button variant="outline" size="sm" onClick={() => openEdit(brand)}>
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={isDeleting}
                    onClick={() => handleDelete(brand.id, brand.name)}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
