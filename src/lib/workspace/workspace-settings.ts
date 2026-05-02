import { z } from 'zod'

const workspaceSettingsSchema = z
  .object({
    /** Если false — роль EDITOR не может планировать и публиковать в каналы (только черновики и согласование). */
    editorsCanPublish: z.boolean().optional(),
  })
  .passthrough()

export type WorkspaceSettings = z.infer<typeof workspaceSettingsSchema>

/** Не задано в JSON → true (как раньше: редакторы могли выкладывать). */
export function getEditorsCanPublishFromSettings(settings: unknown): boolean {
  if (settings == null || typeof settings !== 'object' || Array.isArray(settings)) {
    return true
  }
  const v = (settings as Record<string, unknown>).editorsCanPublish
  if (typeof v === 'boolean') return v
  return true
}

export function mergeWorkspaceSettings(prev: unknown, patch: Partial<WorkspaceSettings>): Record<string, unknown> {
  const base =
    prev && typeof prev === 'object' && !Array.isArray(prev) ? { ...(prev as Record<string, unknown>) } : {}
  const next = { ...base, ...patch }
  const parsed = workspaceSettingsSchema.safeParse(next)
  return (parsed.success ? parsed.data : next) as Record<string, unknown>
}
