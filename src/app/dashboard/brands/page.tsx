import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

import { BrandsClient } from "@/app/dashboard/brands/brands-client";
import { getBrands } from "@/lib/brands/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

async function getUserIdFromAuthCookie(): Promise<string | null> {
  const requestHeaders = await headers();
  return requestHeaders.get("x-user-id");
}

export default async function BrandsPage() {
  const userId = await getUserIdFromAuthCookie();
  if (!userId) {
    redirect("/login");
  }

  const result = await getBrands(userId);
  const brands = result.success ? result.data ?? [] : [];

  return (
    <div className="p-4 md:p-8">
      <div className="mx-auto max-w-[94rem] space-y-4">
        <Card>
          <CardHeader className="space-y-3">
            <Badge variant="secondary" className="w-fit">
              Premium Integration Center
            </Badge>
            <div>
              <CardTitle>Аккаунты и социальные подключения</CardTitle>
              <CardDescription className="mt-1">
                Надежный контроль интеграций: статусы подключения, здоровье аккаунтов и готовность к публикации.
              </CardDescription>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardContent className="pt-6">
            {result.success ? null : (
              <div
                className="mb-4 flex flex-col gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-4"
                role="alert"
              >
                <p className="text-sm text-destructive">
                  {result.error?.message ?? "База данных недоступна. Попробуйте снова."}
                </p>
                <div>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/dashboard/brands">Повторить</Link>
                  </Button>
                </div>
              </div>
            )}
            <BrandsClient brands={brands} userId={userId} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
