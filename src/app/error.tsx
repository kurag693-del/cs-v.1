"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { normalizeObservabilityError } from "@/lib/observability/cost-log";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    const normalized = normalizeObservabilityError(error);
    console.error("Application error:", normalized);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto rounded-full bg-destructive/10 p-3 text-destructive">
            <AlertCircle className="h-6 w-6" />
          </div>
          <CardTitle>Что-то пошло не так</CardTitle>
          <CardDescription>Произошла ошибка при загрузке страницы.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={() => reset()}>
            Попробовать снова
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
