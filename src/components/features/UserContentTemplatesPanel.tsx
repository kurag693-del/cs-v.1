"use client";

import { useCallback, useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import { BookMarked, Loader2, Plus, Trash2 } from "lucide-react";

import {
  createUserContentTemplate,
  deleteUserContentTemplate,
  listUserContentTemplates,
  type UserContentTemplateRow,
} from "@/lib/templates/user-template-actions";
import { TEMPLATE_CATEGORY_LABELS, TEMPLATE_CATEGORY_ORDER, type TemplateCategory } from "@/lib/templates/builtin-templates";
import { userTemplatePayloadToFormPatch } from "@/lib/templates/user-template-payload";
import type { GenerateTextInput } from "@/lib/validation/generate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

type WorkspaceOption = { id: string; name: string; role: string };

type UserContentTemplatesPanelProps = {
  disabled?: boolean;
  workspaces: WorkspaceOption[];
};

function formValuesToPayload(values: GenerateTextInput, category: TemplateCategory) {
  const industry = values.topic.trim().slice(0, 400) || "Пользовательская ниша";
  return {
    industry,
    defaultPrompt: values.topic,
    category,
    suggestedPlatforms: [values.platform],
    tone: values.toneOverride,
    defaultContentType: values.contentType,
    includeEmojisDefault: values.includeEmojis,
  };
}

export function UserContentTemplatesPanel({ disabled, workspaces }: UserContentTemplatesPanelProps) {
  const { toast } = useToast();
  const form = useFormContext<GenerateTextInput>();
  const [rows, setRows] = useState<UserContentTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [scope, setScope] = useState<string>("personal");
  const [category, setCategory] = useState<TemplateCategory>("b2b");

  const load = useCallback(async () => {
    setLoading(true);
    const r = await listUserContentTemplates();
    if (r.success) setRows(r.templates);
    setLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const handleApply = (row: UserContentTemplateRow) => {
    const patch = userTemplatePayloadToFormPatch(row.name, row.payload);
    form.setValue("topic", patch.topic);
    form.setValue("platform", patch.platform);
    form.setValue("toneOverride", patch.toneOverride);
    form.setValue("includeEmojis", patch.includeEmojis);
    if (patch.contentType) form.setValue("contentType", patch.contentType);
    toast({ title: "Шаблон применён", description: row.name });
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast({ title: "Название", description: "Введите название шаблона", variant: "destructive" });
      return;
    }
    const values = form.getValues();
    const payload = formValuesToPayload(values, category);
    setSaving(true);
    const wsId = scope === "personal" ? null : scope;
    const r = await createUserContentTemplate({
      name: trimmed,
      workspaceId: wsId,
      payload,
    });
    setSaving(false);
    if (!r.success) {
      toast({ title: "Ошибка", description: r.error, variant: "destructive" });
      return;
    }
    toast({ title: "Шаблон сохранён", description: trimmed });
    setSaveOpen(false);
    setName("");
    void load();
  };

  const handleDelete = async (id: string) => {
    const r = await deleteUserContentTemplate(id);
    if (!r.success) {
      toast({ title: "Ошибка", description: r.error, variant: "destructive" });
      return;
    }
    toast({ title: "Удалено" });
    void load();
  };

  return (
    <>
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">Мои и командные шаблоны</CardTitle>
              <CardDescription>
                Сохраняйте текущие поля формы как шаблон (личный или для команды в пространстве). Доступ: редактор и выше.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={disabled || loading}
              onClick={() => setSaveOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Сохранить как шаблон
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Загрузка…
            </p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Пока нет сохранённых шаблонов.</p>
          ) : (
            <ul className="space-y-2">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{row.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.workspaceId
                        ? `Команда · ${workspaces.find((w) => w.id === row.workspaceId)?.name ?? "пространство"}`
                        : "Личный шаблон"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button type="button" size="sm" variant="outline" onClick={() => handleApply(row)}>
                      Применить
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => void handleDelete(row.id)}
                      aria-label="Удалить шаблон"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookMarked className="h-5 w-5" />
              Сохранить шаблон
            </DialogTitle>
            <DialogDescription>
              Будут сохранены тема, платформа, тон и тип контента из формы. Тему потом можно править в списке через повторное сохранение.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="ut-name">Название</Label>
              <Input id="ut-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Например: Запуск продукта" />
            </div>
            <div className="space-y-1.5">
              <Label>Вертикаль (категория)</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as TemplateCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_CATEGORY_ORDER.map((c) => (
                    <SelectItem key={c} value={c}>
                      {TEMPLATE_CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Область</Label>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Только я</SelectItem>
                  {workspaces.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      Команда: {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSaveOpen(false)}>
              Отмена
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
