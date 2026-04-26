'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CreateBrandSchema, type CreateBrandInput } from '@/lib/validation/brand'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TagInput } from '@/components/ui/tag-input'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/components/ui/use-toast'
import { useTransition } from 'react'
import { createBrand } from '@/lib/brands/actions'
import { ColorPicker } from '@/components/ui/color-picker'

const formSchema = CreateBrandSchema

export type BrandFormValues = z.infer<typeof formSchema>

interface BrandFormProps {
  userId: string
  initialData?: Partial<BrandFormValues>
  onSuccess?: () => void
}

export function BrandForm({ userId, initialData, onSuccess }: BrandFormProps) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  const form = useForm<BrandFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description || '',
      tone: initialData?.tone || '',
      voice: initialData?.voice || '',
      colors: initialData?.colors || [],
      forbiddenWords: initialData?.forbiddenWords || [],
      examples: initialData?.examples || '',
      website: initialData?.website || '',
      industry: initialData?.industry || '',
      isActive: initialData?.isActive ?? true,
    },
  })

  async function onSubmit(values: BrandFormValues) {
    startTransition(async () => {
      const formData = new FormData()
      formData.set('name', values.name)
      formData.set('description', values.description || '')
      formData.set('tone', values.tone)
      formData.set('voice', values.voice || '')
      formData.set('colors', JSON.stringify(values.colors || []))
      formData.set('forbiddenWords', JSON.stringify(values.forbiddenWords || []))
      formData.set('examples', values.examples || '')
      formData.set('website', values.website || '')
      formData.set('industry', values.industry || '')
      formData.set('isActive', String(values.isActive))

      const result = await createBrand(formData, userId)

      if (result.success) {
        toast({
          title: 'Успех!',
          description: 'Бренд успешно создан',
          variant: 'default',
        })
        form.reset()
        onSuccess?.()
      } else {
        toast({
          title: 'Ошибка',
          description: result.error,
          variant: 'destructive',
        })
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{initialData ? 'Редактировать бренд' : 'Создать бренд'}</CardTitle>
        <CardDescription>
          Заполните информацию о бренде для настройки генерации контента
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Название бренда *</FormLabel>
                  <FormControl>
                    <Input placeholder="TechFlow" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Описание</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Краткое описание бренда" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Тон *</FormLabel>
                    <FormControl>
                      <Input placeholder="Professional yet approachable" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="voice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Голос бренда</FormLabel>
                    <FormControl>
                      <Input placeholder="Innovative and reliable" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="industry"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Отрасль</FormLabel>
                  <FormControl>
                    <Input placeholder="SaaS, Data Analytics, E-commerce..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="colors"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Цветовая палитра</FormLabel>
                  <FormControl>
                    <ColorPicker
                      colors={field.value || []}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormDescription>Выберите до 5 цветов бренда</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="forbiddenWords"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Запрещенные слова</FormLabel>
                  <FormControl>
                    <TagInput
                      tags={field.value || []}
                      onChange={field.onChange}
                      placeholder="Введите слово и нажмите Enter..."
                    />
                  </FormControl>
                  <FormDescription>Слова, которые будут исключены из сгенерированного контента</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="examples"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Примеры контента</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Примеры успешных постов, стиль общения..."
                      className="min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Сайт</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Активный бренд</FormLabel>
                    <FormDescription>
                      Разрешить генерацию контента для этого бренда
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? 'Создание...' : initialData ? 'Обновить' : 'Создать бренд'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
