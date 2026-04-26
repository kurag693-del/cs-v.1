import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { BrandsClient } from "@/app/dashboard/brands/brands-client";
import { getBrands } from "@/lib/brands/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

async function getUserIdFromAuthCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("sb-access-token")?.value;
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8")) as {
      sub?: string;
    };
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export default async function BrandsPage() {
  const userId = await getUserIdFromAuthCookie();
  if (!userId) {
    redirect("/login");
  }

  const result = await getBrands(userId);
  const brands = result.success ? result.data ?? [] : [];

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Управление брендами</CardTitle>
              <CardDescription>Список ваших брендов и доступные действия</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {result.success ? null : (
              <p className="mb-4 text-sm text-destructive">{result.error?.message ?? "Не удалось загрузить бренды"}</p>
            )}
            <BrandsClient brands={brands} userId={userId} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
