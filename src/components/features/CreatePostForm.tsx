'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CreatePostSchema, type CreatePostInput } from '@/lib/validation/posts'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { useTransition } from 'react'
import { createPost } from '@/lib/posts/actions'
import { BrandSelect } from './BrandSelect'
import { useSession } from '@/lib/auth/hooks'
import { useEffect, useState } from 'react'

const formSchema = CreatePostSchema

type PostFormData = z.infer<typeof formSchema>

interface CreatePostFormProps {
  userId: string
  onSuccess?: () => void
  onCancel?: () => void
}

export function CreatePostForm({ userId, onSuccess, onCancel }: CreatePostFormProps) {
  const { user } = useSession()
  const [isPending, startTransition] = useTransition()
  const [availableBrands, setAvailableBrands] = useState<Array<{ id: string; name: string }>>([])
  const { toast } = useToast()

  useEffect(() => {
    if (userId) {
      fetch(`/api/brands?userId=${userId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            setAvailableBrands(data.data)
          }
        })
    }
  }, [userId])

  const form = useForm<PostFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      content: '',
      platform: 'TWITTER',
      mediaUrls: [],
    },
  })

  async function onSubmit(data: PostFormData) {
    startTransition(async () => {
      const formData = new FormData()
      formData.set('title', data.title)
      formData.set('content', data.content)
      formData.set('platform', data.platform)
      formData.set('mediaUrls', JSON.stringify(data.mediaUrls || []))
      formData.set('brandId', data.brandId || '')
      formData.set('metadata', JSON.stringify({}))

      const result = await createPost(formData, userId)

      if (result.success) {
        toast({
          title: 'Успех!',
          description: 'Пост создан (статус: DRAFT)',
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
        <CardTitle>Создать новый пост</CardTitle>
        <CardDescription>
          Пост будет создан со статусом DRAFT. Опубликуйте его через календарь.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Заголовок *</FormLabel>
                  <FormControl>
                    <Input placeholder="Заголовок поста..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Контент *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Текст вашего поста..."
                      className="min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="platform"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Платформа</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите платформу" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="TWITTER">Twitter / X</SelectItem>
                        <SelectItem value="LINKEDIN">LinkedIn</SelectItem>
                        <SelectItem value="FACEBOOK">Facebook</SelectItem>
                        <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                        <SelectItem value="TIKTOK">TikTok</SelectItem>
                        <SelectItem value="YOUTUBE">YouTube</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="brandId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Бренд (опционально)</FormLabel>
                    <BrandSelect
                      brands={availableBrands}
                      onBrandSelect={field.onChange}
                      selectedBrandId={field.value}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={isPending}>
                {isPending ? 'Создание...' : 'Создать пост'}
              </Button>
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Отмена
                </Button>
              )}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
