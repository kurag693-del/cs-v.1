"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { acceptWorkspaceInvite } from "@/lib/workspace/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function AcceptInviteInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("t") ?? "";
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [message, setMessage] = useState<string>("");

  const onAccept = async () => {
    if (!token.trim()) {
      setStatus("err");
      setMessage("В ссылке нет параметра t — запросите новое приглашение.");
      return;
    }
    setStatus("loading");
    const res = await acceptWorkspaceInvite({ token });
    if (!res.success) {
      setStatus("err");
      setMessage(res.error);
      return;
    }
    setStatus("ok");
    setMessage("Вы добавлены в пространство.");
    router.push("/dashboard/workspace");
    router.refresh();
  };

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>Приглашение в пространство</CardTitle>
        <CardDescription>Войдите под email, на который отправлено приглашение, затем примите доступ.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!token ? (
          <Alert variant="destructive">
            <AlertTitle>Некорректная ссылка</AlertTitle>
            <AlertDescription>Откройте полную ссылку из письма или сообщения.</AlertDescription>
          </Alert>
        ) : null}
        {status === "err" ? (
          <Alert variant="destructive">
            <AlertTitle>Не удалось принять</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}
        {status === "ok" ? (
          <Alert>
            <AlertTitle>Готово</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void onAccept()} disabled={status === "loading" || !token}>
            {status === "loading" ? "Обработка…" : "Принять приглашение"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/login">Войти другим аккаунтом</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function JoinWorkspacePage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Suspense fallback={<p className="text-muted-foreground text-sm">Загрузка…</p>}>
        <AcceptInviteInner />
      </Suspense>
    </div>
  );
}
