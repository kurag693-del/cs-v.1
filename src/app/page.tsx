"use client";

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  Layers3,
  Palette,
  Sparkles,
  Wand2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const highlights = [
  {
    title: "Генерация на ИИ",
    text: "Тексты под Instagram, Telegram, VK и другие площадки с учётом тона бренда и структуры хук → тело → призыв к действию.",
    icon: Wand2,
  },
  {
    title: "Календарь и статусы",
    text: "Перетаскивание слотов, черновики, согласование и публикация — без прыжков между таблицами и мессенджерами.",
    icon: CalendarDays,
  },
  {
    title: "Аналитика и рост",
    text: "Сводка по постам и, где подключено, метрики из каналов — чтобы видеть, что сработало.",
    icon: BarChart3,
  },
] as const;

const pillars = [
  {
    title: "Бренд, а не «копипаст»",
    text: "Профиль бренда: голос, примеры, запреты — чтобы нейросеть не превращалась в безликий шаблон.",
    icon: Palette,
  },
  {
    title: "Команда и роли",
    text: "Рабочие пространства, приглашения и права: кто пишет, кто согласует, кто выкладывает в канал.",
    icon: Layers3,
  },
  {
    title: "Контент под задачу",
    text: "Библиотека ниш и сценариев: быстрый старт без пустого листа — от онбординга до генератора.",
    icon: Sparkles,
  },
] as const;

const checklist = [
  "Несколько ИИ-провайдеров и гибкий выбор модели",
  "Визуальный редактор обложек и загрузка медиа (при настроенном хранилище)",
  "Экспорт и задел под автопубликацию в российских соцсетях",
] as const;

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <div className="absolute inset-x-0 top-0 h-[min(42vh,480px)] bg-gradient-to-b from-primary/8 via-primary/3 to-transparent pointer-events-none" aria-hidden />
      <main className="relative mx-auto max-w-6xl px-4 py-10 md:px-6 md:py-16 lg:py-20">
        <section className="space-y-6 md:space-y-8">
          <div className="text-center space-y-5 md:space-y-6 max-w-3xl mx-auto">
            <Badge
              variant="secondary"
              className="border border-border/80 bg-card/80 px-3 py-1 text-xs font-medium tracking-wide"
            >
              Платформа для контента в соцсетях
            </Badge>
            <h1 className="text-4xl font-bold tracking-[-0.04em] text-foreground sm:text-5xl md:text-6xl text-balance">
              Креатив-студия
            </h1>
            <p className="text-base leading-relaxed text-muted-foreground md:text-lg md:leading-relaxed text-pretty">
              Одно место для генерации постов на искусственном интеллекте, планирования в календаре и контроля результата —
              от черновика до публикации и цифр по охвату.
            </p>
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center sm:items-center pt-1">
              <Button size="lg" className="h-12 rounded-xl text-base shadow-sm" asChild>
                <Link href="/register">
                  Начать бесплатно
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-12 rounded-xl text-base" asChild>
                <Link href="/login">Войти</Link>
              </Button>
              <Button size="lg" variant="ghost" className="h-12 rounded-xl text-muted-foreground" asChild>
                <Link href="/pricing">Тарифы</Link>
              </Button>
            </div>
          </div>

          <Card className="overflow-hidden rounded-3xl border-border/90 shadow-[0_1px_0_rgba(0,0,0,0.04)] bg-card/95 backdrop-blur-sm">
            <CardContent className="grid gap-8 p-6 md:p-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 items-start">
              <div className="space-y-5">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Основной сценарий
                </p>
                <ul className="space-y-4">
                  {[
                    { step: "1", label: "Задаёте тему, платформу и голос бренда — получаете черновик текста." },
                    { step: "2", label: "Согласование при необходимости — затем перенос в календарь и время выхода." },
                    { step: "3", label: "Публикация и сбор метрик: видно, что принесло отклик." },
                  ].map((row) => (
                    <li key={row.step} className="flex gap-4">
                      <span
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary",
                          "text-sm font-semibold tabular-nums text-foreground"
                        )}
                      >
                        {row.step}
                      </span>
                      <p className="text-[0.9375rem] leading-relaxed text-foreground pt-1">{row.label}</p>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-border bg-gradient-to-br from-secondary/80 to-muted/40 p-6 md:p-7">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground mb-4">
                  Три опоры продукта
                </p>
                <div className="space-y-3">
                  {highlights.map(({ title, text, icon: Icon }) => (
                    <div
                      key={title}
                      className="rounded-xl border border-border/80 bg-card px-4 py-3.5 shadow-[var(--shadow-xs)] transition-colors hover:bg-card/95"
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Icon className="h-4 w-4" aria-hidden />
                        </span>
                        <div>
                          <p className="font-semibold text-foreground">{title}</p>
                          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{text}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3 pt-2">
            {pillars.map(({ title, text, icon: Icon }) => (
              <Card
                key={title}
                className="silent-lift rounded-2xl border-border/90 bg-card/80"
              >
                <CardHeader className="pb-2">
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <CardTitle className="text-lg leading-snug">{title}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <CardDescription className="text-sm leading-relaxed">{text}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="rounded-3xl border-primary/15 bg-muted/30">
            <CardContent className="flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between md:p-8">
              <div className="space-y-3 max-w-xl">
                <p className="text-sm font-medium text-foreground">Подходит командам и соло-авторам</p>
                <ul className="space-y-2.5">
                  {checklist.map((line) => (
                    <li key={line} className="flex gap-2.5 text-sm text-muted-foreground leading-relaxed">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex shrink-0 flex-col gap-3 sm:flex-row md:flex-col lg:flex-row">
                <Button size="lg" className="rounded-xl" asChild>
                  <Link href="/register">
                    Создать аккаунт
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="rounded-xl bg-background/80" asChild>
                  <Link href="/login">Уже есть вход — войти</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <footer className="border-t border-border/80 pt-8 pb-4 text-center text-xs text-muted-foreground">
            <p>
              © {new Date().getFullYear()} Креатив-студия. Все права защищены.
            </p>
          </footer>
        </section>
      </main>
    </div>
  );
}
