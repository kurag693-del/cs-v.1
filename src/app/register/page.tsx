"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";

import { registerUser } from "@/lib/auth/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError("Пароли не совпадают");
      setLoading(false);
      return;
    }

    const result = await registerUser(email, password);
    if (!result.success) {
      setError(result.error);
      setLoading(false);
      return;
    }

    localStorage.setItem(
      "local-auth-user",
      JSON.stringify({ id: result.user.id, email: result.user.email })
    );
    setLoading(false);
    window.location.assign("/onboarding");
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl items-center gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="hidden rounded-3xl border-border bg-card lg:block">
          <CardContent className="space-y-5 p-8">
            <Badge variant="secondary" className="w-fit">
              Рабочее пространство
            </Badge>
            <div className="space-y-3">
              <h1 className="text-4xl font-bold tracking-[-0.03em]">Создайте аккаунт</h1>
              <p className="text-[0.9375rem] text-muted-foreground">
                После регистрации откроется онбординг: пространство, бренд, первые шаги в генераторе и календаре.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-secondary p-4">
              <p className="inline-flex items-center gap-2 text-[0.875rem] font-medium">
                <Sparkles className="h-4 w-4 text-primary" />
                Онбординг сразу после входа
              </p>
              <p className="mt-1 text-[0.8125rem] text-muted-foreground">
                Не нужно искать раздел вручную — проведём по продукту по шагам.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="w-full rounded-3xl border-border bg-card">
          <CardHeader>
            <CardTitle className="text-center text-2xl">Регистрация</CardTitle>
            <CardDescription className="text-center">Креатив-студия — контент для соцсетей с ИИ</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Пароль</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Не менее 8 символов"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  disabled={loading}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Пароль ещё раз</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Повторите пароль"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="new-password"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Создаём аккаунт…" : "Зарегистрироваться"}
                {!loading ? <ArrowRight className="h-4 w-4" /> : null}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center">
            <p className="text-sm text-muted-foreground">
              Уже есть аккаунт?{" "}
              <Link href="/login" className="text-primary hover:underline">
                Войти
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
