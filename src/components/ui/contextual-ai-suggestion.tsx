"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type ContextualAiSuggestionProps = {
  text: string;
  className?: string;
};

export function ContextualAiSuggestion({ text, className }: ContextualAiSuggestionProps) {
  return (
    <div
      className={cn(
        "silent-lift rounded-xl border border-border bg-secondary px-3.5 py-3 text-[0.875rem] text-foreground",
        className
      )}
    >
      <p className="inline-flex items-start gap-2">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span>{text}</span>
      </p>
    </div>
  );
}
