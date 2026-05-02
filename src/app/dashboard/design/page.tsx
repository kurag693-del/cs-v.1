import { redirect } from "next/navigation";

import { PostDesigner } from "@/components/features/PostDesigner";
import { validateSession } from "@/lib/auth/lucia";

function isS3Configured(): boolean {
  const bucket = process.env.S3_BUCKET?.trim()
  const publicUrl = process.env.S3_PUBLIC_URL?.trim()
  return Boolean(bucket && publicUrl)
}

export default async function DesignPage() {
  const { user } = await validateSession()
  const userId = user?.id ?? null
  if (!userId) {
    redirect("/login")
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Визуальный редактор</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Соберите обложку поста и экспортируйте PNG для календаря и публикаций.
        </p>
      </div>
      <PostDesigner userId={userId} allowCloudUpload={isS3Configured()} />
    </div>
  )
}
