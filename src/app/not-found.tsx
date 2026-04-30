import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md overflow-hidden">
        <CardHeader className="text-center">
          <CardTitle>Страница не найдена</CardTitle>
          <CardDescription>
            Запрошенная страница отсутствует или была перемещена.
          </CardDescription>
        </CardHeader>
        <CardContent className="min-w-0 max-w-full px-4 pb-6 sm:px-6">
          <div className="pr-1">
            <Button asChild className="h-11 w-full min-w-0 max-w-full box-border">
              <Link href="/dashboard">Вернуться в дашборд</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
