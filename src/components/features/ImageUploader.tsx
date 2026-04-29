'use client'

import { ImagePlus, Loader2, Trash2, UploadCloud } from 'lucide-react'
import { useRef, useState } from 'react'
import { uploadImage } from '@/lib/storage/upload'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

type ImageUploaderProps = {
  userId: string
  value: string | null
  onChange: (url: string | null) => void
}

export function ImageUploader({ userId, value, onChange }: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [statusText, setStatusText] = useState<string>('Идет загрузка в хранилище')

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Можно загружать только изображения')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Максимальный размер файла — 5 МБ')
      return
    }

    setError(null)
    setIsUploading(true)
    setProgress(10)
    setStatusText('Загружаем изображение... это может занять до минуты')
    const timer = setInterval(() => {
      setProgress((current) => (current >= 90 ? current : current + 10))
    }, 180)

    try {
      const result = await uploadImage(file, userId)
      if (!result.success) {
        setError(result.error)
        return
      }
      setProgress(100)
      onChange(result.url)
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Ошибка загрузки')
    } finally {
      clearInterval(timer)
      setTimeout(() => {
        setIsUploading(false)
        setProgress(0)
      }, 250)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Изображение для поста</p>
        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
          {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
          Выбрать файл
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void handleFile(file)
          event.currentTarget.value = ''
        }}
      />

      <label
        className={`relative flex flex-col items-center justify-center rounded-md border border-dashed p-5 text-center text-sm text-muted-foreground ${
          isUploading ? 'cursor-not-allowed' : 'cursor-pointer'
        }`}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          const file = event.dataTransfer.files?.[0]
          if (file && !isUploading) void handleFile(file)
        }}
        onClick={() => {
          if (!isUploading) {
            fileInputRef.current?.click()
          }
        }}
      >
        {!isUploading ? (
          <>
            <ImagePlus className="mb-2 h-5 w-5" />
            Перетащите изображение сюда или нажмите для выбора
          </>
        ) : null}
        {isUploading ? (
          <span className="absolute inset-0 flex items-center justify-center rounded-md bg-background/80 text-sm font-medium text-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Загружаем изображение...
          </span>
        ) : null}
      </label>

      {isUploading ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{statusText}</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} />
        </div>
      ) : null}
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}

      {value ? (
        <div className="relative space-y-2">
          <img
            src={value}
            alt="Uploaded preview"
            className={`max-h-52 w-full rounded-md border object-cover ${isUploading ? 'opacity-60' : ''}`}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => onChange(null)} disabled={isUploading}>
            <Trash2 className="mr-2 h-4 w-4" />
            Удалить
          </Button>
        </div>
      ) : null}
    </div>
  )
}
