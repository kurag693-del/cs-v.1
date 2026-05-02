"use client";

import { BookmarkCheck, Check, Heart } from "lucide-react";
import { useMemo, useState } from "react";

import type { BuiltinTemplate, TemplateCategory } from "@/lib/templates/builtin-templates";
import {
  BUILTIN_TEMPLATES,
  filterBuiltinTemplates,
  orderBuiltinTemplatesForUi,
  TEMPLATE_CATEGORY_LABELS,
  TEMPLATE_CATEGORY_ORDER,
} from "@/lib/templates/builtin-templates";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type TemplateSelectorProps =
  | {
      mode?: "form";
      selectedId: string | null;
      onApply: (template: BuiltinTemplate) => void;
      favoriteIds?: string[];
      preferredTemplateId?: string | null;
      onToggleFavorite?: (templateId: string) => void | Promise<void>;
      onSetPreferred?: (templateId: string | null) => void | Promise<void>;
      disabled?: boolean;
    }
  | {
      mode: "linkToGenerate";
      disabled?: boolean;
    };

const CATEGORIES_IN_CATALOG: TemplateCategory[] = TEMPLATE_CATEGORY_ORDER.filter((c) =>
  BUILTIN_TEMPLATES.some((t) => t.category === c)
);

export function TemplateSelector(props: TemplateSelectorProps) {
  const disabled = props.disabled ?? false;
  const isForm = props.mode !== "linkToGenerate";
  const selectedId = isForm ? props.selectedId : null;
  const onApply = isForm ? props.onApply : null;
  const favoriteIds = isForm ? (props.favoriteIds ?? []) : [];
  const preferredId = isForm ? (props.preferredTemplateId ?? null) : null;
  const onToggleFavorite = isForm ? props.onToggleFavorite : undefined;
  const onSetPreferred = isForm ? props.onSetPreferred : undefined;

  const [category, setCategory] = useState<TemplateCategory | "all">("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () => filterBuiltinTemplates({ category, search }),
    [category, search]
  );

  const ordered = useMemo(
    () => orderBuiltinTemplatesForUi(filtered, favoriteIds, preferredId),
    [filtered, favoriteIds, preferredId]
  );

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Библиотека ниш</p>
        <p className="text-xs text-muted-foreground">
          Фильтр, поиск, избранное и «основной» шаблон — тему всегда можно править перед генерацией.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по названию или нише…"
          disabled={disabled}
          className="sm:max-w-xs"
          aria-label="Поиск шаблонов"
        />
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={category === "all" ? "default" : "outline"}
            className="h-8 text-xs"
            disabled={disabled}
            onClick={() => setCategory("all")}
          >
            Все
          </Button>
          {CATEGORIES_IN_CATALOG.map((c) => (
            <Button
              key={c}
              type="button"
              size="sm"
              variant={category === c ? "default" : "outline"}
              className="h-8 text-xs"
              disabled={disabled}
              onClick={() => setCategory(c)}
            >
              {TEMPLATE_CATEGORY_LABELS[c]}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {ordered.map((template) => {
          const isActive = isForm && selectedId === template.id;
          const isFav = favoriteIds.includes(template.id);
          const isPreferred = preferredId === template.id;
          return (
            <Card
              key={template.id}
              className={cn(
                "border transition-colors",
                isActive ? "border-primary/60 bg-primary/5" : "border-border"
              )}
            >
              <CardHeader className="space-y-1 p-3 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <CardTitle className="text-sm font-medium leading-tight">{template.name}</CardTitle>
                      <Badge variant="outline" className="text-[0.65rem] font-normal">
                        {TEMPLATE_CATEGORY_LABELS[template.category]}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs leading-snug">{template.industry}</CardDescription>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    {isActive ? (
                      <span className="text-primary" aria-hidden>
                        <Check className="h-4 w-4" />
                      </span>
                    ) : null}
                    {isForm && onToggleFavorite ? (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        disabled={disabled}
                        aria-label={isFav ? "Убрать из избранного" : "В избранное"}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void onToggleFavorite(template.id);
                        }}
                      >
                        <Heart
                          className={cn("h-4 w-4", isFav ? "fill-primary text-primary" : "text-muted-foreground")}
                        />
                      </Button>
                    ) : null}
                    {isForm && onSetPreferred ? (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        disabled={disabled}
                        aria-label={isPreferred ? "Снять как основной" : "Сделать основным шаблоном"}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void onSetPreferred(isPreferred ? null : template.id);
                        }}
                      >
                        <BookmarkCheck
                          className={cn(
                            "h-4 w-4",
                            isPreferred ? "text-primary" : "text-muted-foreground"
                          )}
                        />
                      </Button>
                    ) : null}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="mb-2 flex flex-wrap gap-1">
                  {template.suggestedPlatforms.map((p) => (
                    <Badge key={p} variant="secondary" className="text-[0.65rem] font-normal">
                      {p}
                    </Badge>
                  ))}
                </div>
                {!isForm ? (
                  <Button
                    asChild
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={disabled}
                  >
                    <a href={`/dashboard/generate?template=${encodeURIComponent(template.id)}`}>
                      Открыть в генераторе
                    </a>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant={isActive ? "secondary" : "default"}
                    className="w-full"
                    disabled={disabled}
                    onClick={() => onApply?.(template)}
                  >
                    {isActive ? "Повторно применить" : "Применить"}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {ordered.length === 0 ? (
        <p className="text-xs text-muted-foreground">Нет шаблонов по фильтру — сбросьте поиск или категорию.</p>
      ) : null}
    </div>
  );
}
