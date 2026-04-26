'use client'

import { useState } from 'react'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Edit, Trash2 } from 'lucide-react'
import { deleteBrand } from '@/lib/brands/actions'
import { BrandForm } from './BrandForm'

interface Brand {
  id: string
  name: string
  description: string | null
  industry?: string | null
  tone: string | null
  voice: string | null
  colors: string[]
  logo: string | null
  isActive: boolean
  userId: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

interface BrandListProps {
  userId: string
  initialBrands: Brand[]
}

export function BrandList({ userId, initialBrands }: BrandListProps) {
  const [brands, setBrands] = useState<Brand[]>(initialBrands)
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const { toast } = useToast()

  const handleDelete = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот бренд?')) return

    const result = await deleteBrand(id, userId)

    if (result.success) {
      setBrands(brands.filter((b) => b.id !== id))
      toast({
        title: 'Успех!',
        description: 'Бренд успешно удален (мягкое удаление)',
        variant: 'default',
      })
    } else {
      toast({
        title: 'Ошибка',
        description: result.error,
        variant: 'destructive',
      })
    }
  }

  const handleEdit = (brand: Brand) => {
    setEditingBrand(brand)
    setIsFormOpen(true)
  }

  const handleSuccess = () => {
    // Refresh brands list
    fetch(`/api/brands?userId=${userId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setBrands(data.data)
        }
      })
    setIsFormOpen(false)
    setEditingBrand(null)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  if (!isFormOpen && !brands.length) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">Бренды не найдены</p>
        <Button onClick={() => setIsFormOpen(true)}>Создать первый бренд</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Управление брендами</h2>
        {!isFormOpen && (
          <Button onClick={() => setIsFormOpen(true)}>Создать бренд</Button>
        )}
      </div>

      {isFormOpen && (
        <div className="mb-6">
          <BrandForm
            userId={userId}
            initialData={
              editingBrand
                ? {
                    name: editingBrand.name,
                    description: editingBrand.description ?? undefined,
                    tone: editingBrand.tone ?? '',
                    voice: editingBrand.voice ?? undefined,
                    colors: editingBrand.colors ?? [],
                    industry: editingBrand.industry ?? undefined,
                    isActive: editingBrand.isActive,
                  }
                : undefined
            }
            onSuccess={handleSuccess}
          />
          {editingBrand && (
            <Button
              variant="ghost"
              onClick={() => {
                setIsFormOpen(false)
                setEditingBrand(null)
              }}
              className="mt-4"
            >
              Отмена
            </Button>
          )}
        </div>
      )}

      {!isFormOpen && brands.length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Отрасль</TableHead>
                <TableHead>Цвета</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Создан</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {brands.map((brand) => (
                <TableRow key={brand.id}>
                  <TableCell className="font-medium">
                    <div>
                      <div>{brand.name}</div>
                      {brand.description && (
                        <div className="text-sm text-muted-foreground">
                          {brand.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{brand.industry || '-'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {(brand.colors || []).map((color, i) => (
                        <div
                          key={i}
                          className="h-4 w-4 rounded-sm border"
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        brand.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {brand.isActive ? 'Активен' : 'Неактивен'}
                    </span>
                  </TableCell>
                  <TableCell>{formatDate(brand.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(brand)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Редактировать
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(brand.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Удалить
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
