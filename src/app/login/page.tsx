"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";

import { signInWithEmailAndNextPath } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const result = await signInWithEmailAndNextPath(email, password);
    if (!result.success) {
      setError(result.error);
      setLoading(false);
      return;
    }
    localStorage.setItem(
      "local-auth-user",
      JSON.stringify({ id: result.user.id, email: result.user.email ?? email })
    );

    setSuccess(true);
    setLoading(false);
    window.location.assign(result.redirectTo);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl items-center gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="hidden rounded-3xl border-border bg-card lg:block">
          <CardContent className="space-y-5 p-8">
            <Badge variant="secondary" className="w-fit">
              Welcome Back
            </Badge>
            <div className="space-y-3">
              <h1 className="text-4xl font-bold tracking-[-0.03em]">Calm premium workspace</h1>
              <p className="text-[0.9375rem] text-muted-foreground">
                Продолжайте создавать, планировать и публиковать контент в единой AI-среде.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-secondary p-4">
              <p className="inline-flex items-center gap-2 text-[0.875rem] font-medium">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Secure session
              </p>
              <p className="mt-1 text-[0.8125rem] text-muted-foreground">Ваши данные и доступ защищены на каждом шаге.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="w-full rounded-3xl border-border bg-card">
          <CardHeader className="space-y-2">
            <CardTitle className="text-center text-2xl">Вход</CardTitle>
            <CardDescription className="text-center">Войдите в аккаунт Креатив-студии</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Пароль</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Введите пароль"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={loading}
                  minLength={6}
                  required
                />
              </div>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              {success ? <p className="text-sm text-green-600">Успешный вход, перенаправляем...</p> : null}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Вход..." : "Войти"}
                {!loading ? <ArrowRight className="h-4 w-4" /> : null}
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Нет аккаунта?{" "}
              <Link href="/register" className="text-primary hover:underline">
                Создать
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
