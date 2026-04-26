import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Страница не найдена</CardTitle>
          <CardDescription>
            Запрошенная страница отсутствует или была перемещена.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/dashboard">Вернуться в дашборд</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
