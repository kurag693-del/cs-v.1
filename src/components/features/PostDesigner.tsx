"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, ImagePlus, Loader2, Upload } from "lucide-react";

import type { DesignPresetId } from "@/lib/design/templates";
import {
  DESIGN_PRESETS,
  MAX_EXPORT_BYTES,
  getDesignPresetById,
} from "@/lib/design/templates";
import { coverSourceRect, wrapTextLines } from "@/lib/design/canvas-layout";
import { uploadImage } from "@/lib/storage/upload";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

type PostDesignerProps = {
  userId: string;
  /** S3 настроен на сервере — показываем кнопку «В облако». */
  allowCloudUpload: boolean;
};

function drawFrame(
  ctx: CanvasRenderingContext2D,
  preset: (typeof DESIGN_PRESETS)[number],
  opts: {
    bgColor: string;
    image: HTMLImageElement | null;
    headline: string;
    subtitle: string;
  }
): void {
  const { width: W, height: H, safePadding } = preset
  ctx.fillStyle = opts.bgColor
  ctx.fillRect(0, 0, W, H)

  if (opts.image && opts.image.complete && opts.image.naturalWidth > 0) {
    const { sx, sy, sw, sh } = coverSourceRect(
      opts.image.naturalWidth,
      opts.image.naturalHeight,
      W,
      H
    )
    ctx.drawImage(opts.image, sx, sy, sw, sh, 0, 0, W, H)
    const g = ctx.createLinearGradient(0, H * 0.45, 0, H)
    g.addColorStop(0, "rgba(0,0,0,0)")
    g.addColorStop(1, "rgba(0,0,0,0.72)")
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  }

  const pad = safePadding
  const maxTextW = W - pad * 2
  const baseHead = Math.round(Math.min(W, H) * 0.065)
  const baseSub = Math.round(baseHead * 0.48)
  ctx.textBaseline = "top"
  ctx.fillStyle = "#ffffff"
  ctx.shadowColor = "rgba(0,0,0,0.55)"
  ctx.shadowBlur = 8
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 2

  ctx.font = `700 ${baseHead}px system-ui, "Segoe UI", sans-serif`
  const headLines = wrapTextLines((s) => ctx.measureText(s).width, opts.headline, maxTextW)
  let y = H - pad - baseHead * (opts.subtitle ? 3.2 : 2)
  for (const ln of headLines.slice(0, 5)) {
    ctx.fillText(ln, pad, y)
    y += baseHead * 1.15
  }

  if (opts.subtitle.trim()) {
    ctx.font = `500 ${baseSub}px system-ui, "Segoe UI", sans-serif`
    ctx.globalAlpha = 0.92
    const subLines = wrapTextLines((s) => ctx.measureText(s).width, opts.subtitle, maxTextW)
    for (const ln of subLines.slice(0, 4)) {
      ctx.fillText(ln, pad, y)
      y += baseSub * 1.2
    }
    ctx.globalAlpha = 1
  }

  ctx.shadowBlur = 0
}

export function PostDesigner({ userId, allowCloudUpload }: PostDesignerProps) {
  const { toast } = useToast()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [presetId, setPresetId] = useState<DesignPresetId>("instagram_square")
  const [headline, setHeadline] = useState("Заголовок поста")
  const [subtitle, setSubtitle] = useState("")
  const [bgColor, setBgColor] = useState("#2d3748")
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null)
  const [uploading, setUploading] = useState(false)

  const preset = useMemo(() => getDesignPresetById(presetId) ?? DESIGN_PRESETS[0], [presetId])

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const presetDims = getDesignPresetById(presetId) ?? DESIGN_PRESETS[0]
    canvas.width = presetDims.width
    canvas.height = presetDims.height
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    drawFrame(ctx, presetDims, {
      bgColor,
      image: imageEl,
      headline,
      subtitle,
    })
  }, [presetId, bgColor, imageEl, headline, subtitle])

  useEffect(() => {
    redraw()
  }, [redraw])

  const onPickImage = (file: File | null) => {
    if (!file || !file.type.startsWith("image/")) {
      setImageEl(null)
      return
    }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      setImageEl(img)
    }
    img.src = url
  }

  const buildExportBlob = (): Promise<Blob> => {
    const canvas = canvasRef.current
    if (!canvas) return Promise.reject(new Error("Нет холста"))
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (!b) reject(new Error("Не удалось собрать PNG"))
          else resolve(b)
        },
        "image/png",
        1
      )
    })
  }

  const handleDownload = async () => {
    try {
      const blob = await buildExportBlob()
      if (blob.size > MAX_EXPORT_BYTES) {
        toast({
          title: "Файл слишком большой",
          description: "Уменьшите размер или упростите текст.",
          variant: "destructive",
        })
        return
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `post-${preset.id}.png`
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: "PNG сохранён", description: "Проверьте папку загрузок." })
    } catch (e) {
      toast({
        title: "Ошибка экспорта",
        description: e instanceof Error ? e.message : "Неизвестная ошибка",
        variant: "destructive",
      })
    }
  }

  const handleUploadS3 = async () => {
    if (!allowCloudUpload) return
    setUploading(true)
    try {
      const blob = await buildExportBlob()
      if (blob.size > MAX_EXPORT_BYTES) {
        toast({
          title: "Файл слишком большой",
          description: "Лимит 5 МБ для загрузки.",
          variant: "destructive",
        })
        return
      }
      const file = new File([blob], `design-${preset.id}.png`, { type: "image/png" })
      const result = await uploadImage(file, userId)
      if (!result.success) {
        toast({
          title: "Загрузка не удалась",
          description: result.error.message,
          variant: "destructive",
        })
        return
      }
      toast({
        title: "Загружено в хранилище",
        description: result.data.url.slice(0, 80) + (result.data.url.length > 80 ? "…" : ""),
      })
    } catch (e) {
      toast({
        title: "Ошибка",
        description: e instanceof Error ? e.message : "Неизвестная ошибка",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
    }
  }

  const displayMax = "min(100%, min(92vw, 720px))"

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card>
        <CardHeader>
          <CardTitle>Визуальный редактор</CardTitle>
          <CardDescription>
            Текст и фоновое изображение на одном холсте. Экспорт PNG для календаря и публикаций.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!allowCloudUpload ? (
            <Alert>
              <AlertTitle>Облако не подключено</AlertTitle>
              <AlertDescription>
                Задайте S3 в .env — появится кнопка загрузки в хранилище. Пока доступно скачивание PNG на устройство.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="overflow-hidden rounded-xl border bg-muted/30 p-3">
            <canvas
              ref={canvasRef}
              className="mx-auto block h-auto max-h-[min(78vh,920px)] w-full rounded-lg shadow-md"
              style={{ maxWidth: displayMax }}
              aria-label="Предпросмотр поста"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => void handleDownload()}>
              <Download className="mr-2 h-4 w-4" />
              Скачать PNG
            </Button>
            {allowCloudUpload ? (
              <Button type="button" onClick={() => void handleUploadS3()} disabled={uploading}>
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                В облако (S3)
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-base">Параметры</CardTitle>
          <CardDescription>Формат, текст и фото.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Формат</Label>
            <Select value={presetId} onValueChange={(v) => setPresetId(v as DesignPresetId)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DESIGN_PRESETS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label} · {p.width}×{p.height}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{preset.description}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pd-head">Заголовок</Label>
            <Input
              id="pd-head"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              maxLength={220}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pd-sub">Подзаголовок (необязательно)</Label>
            <Input
              id="pd-sub"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              maxLength={280}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pd-bg">Фон (если нет фото)</Label>
            <Input
              id="pd-bg"
              type="color"
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
              className="h-10 w-full cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pd-img">Фоновое изображение</Label>
            <div className="flex items-center gap-2">
              <Input
                id="pd-img"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="text-sm"
                onChange={(e) => onPickImage(e.target.files?.[0] ?? null)}
              />
              <ImagePlus className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setImageEl(null)}>
              Убрать фото
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
