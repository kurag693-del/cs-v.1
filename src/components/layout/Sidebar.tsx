"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Home,
  Link2,
  LogOut,
  Menu,
  Moon,
  Palette,
  Sparkles,
  Sun,
  Wallet,
} from "lucide-react";

import { signOut } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const navGroups = [
  {
    title: "Работа",
    items: [
      { href: "/dashboard", label: "Главная", icon: Home },
      { href: "/dashboard/brands", label: "Бренды", icon: Palette },
      { href: "/dashboard/generate", label: "Генератор", icon: Sparkles },
      { href: "/dashboard/calendar", label: "Календарь", icon: CalendarDays },
      { href: "/dashboard/integrations", label: "Интеграции", icon: Link2 },
    ],
  },
  {
    title: "Рост",
    items: [
      { href: "/dashboard/analytics", label: "Аналитика", icon: BarChart3 },
      { href: "/pricing", label: "Тарифы", icon: Wallet },
    ],
  },
] as const;

type SidebarContentProps = {
  onNavigate?: () => void;
  compact?: boolean;
};

function SidebarContent({ onNavigate, compact = false }: SidebarContentProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isDark, setIsDark] = useState(() => {
    if (typeof document === "undefined") return false;
    return document.documentElement.classList.contains("dark");
  });

  const toggleTheme = () => {
    const root = document.documentElement;
    const nextIsDark = !isDark;

    root.classList.toggle("dark", nextIsDark);
    localStorage.setItem("theme", nextIsDark ? "dark" : "light");
    setIsDark(nextIsDark);
  };

  const profileInitials = useMemo(() => "CS", []);

  const handleSignOut = async () => {
    await signOut();

    localStorage.removeItem("local-auth-user");
    document.cookie = "session=; Max-Age=0; Path=/";

    router.push("/login");
    router.refresh();
  };

  return (
    <div className={cn("flex h-full flex-col p-4", compact ? "min-h-0" : "h-screen")}>
      <div className="space-y-7 overflow-y-auto pr-1">
        <div className="px-2">
          <p className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            AI-студия контента
          </p>
          <p className="mt-2 text-xl font-semibold tracking-[-0.02em]">Креатив-студия</p>
        </div>

        <nav className="space-y-5">
          {navGroups.map((group) => (
            <section key={group.title} className="space-y-2">
              <p className="px-2 text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {group.title}
              </p>
              <div className="space-y-1.5">
                {group.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.9375rem] no-underline transition-all duration-200",
                        isActive
                          ? "border border-border bg-secondary text-foreground shadow-[var(--shadow-xs)]"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-[1.0625rem] w-[1.0625rem] shrink-0 transition-colors",
                          isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>
      </div>

      <div className="mt-4 space-y-3 border-t border-border pt-3">
        <div className="rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-xs)]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-[0.8125rem] font-semibold">
              {profileInitials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[0.9375rem] font-medium">Рабочее пространство</p>
              <p className="truncate text-[0.8125rem] text-muted-foreground">Премиум-тариф</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button variant="secondary" size="sm" onClick={toggleTheme} className="w-full justify-start gap-2">
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {isDark ? "Светлая тема" : "Темная тема"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleSignOut} className="w-full justify-start gap-2">
            <LogOut className="h-4 w-4" />
            Выйти
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  return <SidebarContent />;
}

export function MobileSidebar() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Открыть меню">
          <Menu className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="h-[90vh] w-[92vw] max-w-sm p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle>Меню</DialogTitle>
        </DialogHeader>
        <SidebarContent compact />
      </DialogContent>
    </Dialog>
  );
}
