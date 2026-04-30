'use client'

import Image from 'next/image'
import { ImagePlus, Loader2, Trash2, UploadCloud } from 'lucide-react'
import { useRef, useState } from 'react'
import { uploadImage } from '@/lib/storage/upload'
import { IMAGE_MIME_WHITELIST, MAX_MEDIA_FILE_SIZE_BYTES, MAX_MEDIA_FILES_PER_POST } from '@/lib/validation/media'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

type ImageUploaderProps = {
  userId: string
  value: string[]
  onChange: (urls: string[]) => void
}

export function ImageUploader({ userId, value, onChange }: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [statusText, setStatusText] = useState<string>('Идет загрузка в хранилище')

  const validateFile = (file: File): string | null => {
    if (!IMAGE_MIME_WHITELIST.includes(file.type as (typeof IMAGE_MIME_WHITELIST)[number])) {
      return 'Разрешены только JPG, PNG, WEBP или GIF'
    }
    if (file.size > MAX_MEDIA_FILE_SIZE_BYTES) {
      return 'Максимальный размер файла — 5 МБ'
    }
    return null
  }

  const handleFiles = async (files: FileList | File[]) => {
    if (isUploading) return
    const items = Array.from(files)
    if (items.length === 0) return

    const availableSlots = Math.max(0, MAX_MEDIA_FILES_PER_POST - value.length)
    if (availableSlots <= 0) {
      setError(`Достигнут лимит: максимум ${MAX_MEDIA_FILES_PER_POST} изображений`)
      return
    }

    const filesToUpload = items.slice(0, availableSlots)
    const firstInvalid = filesToUpload.map(validateFile).find(Boolean)
    if (firstInvalid) {
      setError(firstInvalid)
      return
    }

    setError(null)
    setIsUploading(true)
    setProgress(10)
    setStatusText(`Загружаем ${filesToUpload.length} изображени${filesToUpload.length > 1 ? 'я' : 'е'}...`)
    const timer = setInterval(() => {
      setProgress((current) => (current >= 90 ? current : current + 10))
    }, 180)

    try {
      const uploadedUrls: string[] = []
      for (const file of filesToUpload) {
        const result = await uploadImage(file, userId)
        if (!result.success) {
          setError(result.error.message)
          break
        }
        uploadedUrls.push(result.data.url)
      }
      if (uploadedUrls.length > 0) {
        setProgress(100)
        onChange(Array.from(new Set([...value, ...uploadedUrls])))
      }
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
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files?.length) void handleFiles(event.target.files)
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
          if (event.dataTransfer.files?.length && !isUploading) void handleFiles(event.dataTransfer.files)
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
            Перетащите изображения сюда или нажмите для выбора (до {MAX_MEDIA_FILES_PER_POST} файлов)
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

      {value.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Загружено: {value.length}/{MAX_MEDIA_FILES_PER_POST}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {value.map((url) => (
              <div key={url} className="space-y-2">
                <div className={`relative h-44 w-full overflow-hidden rounded-md border ${isUploading ? 'opacity-60' : ''}`}>
                  <Image src={url} alt="Uploaded preview" fill className="object-cover" unoptimized />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onChange(value.filter((item) => item !== url))}
                  disabled={isUploading}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Удалить
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
