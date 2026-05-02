'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, Plus, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const navItems = [
  { href: '/dashboard', label: 'Главная' },
  { href: '/dashboard/workspace', label: 'Команда' },
  { href: '/dashboard/brands', label: 'Бренды' },
  { href: '/dashboard/generate', label: 'Генерация' },
  { href: '/dashboard/calendar', label: 'Календарь' },
  { href: '/dashboard/analytics', label: 'Аналитика' },
  { href: '/pricing', label: 'Тарифы' },
] as const

export function DashboardTopNav() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex w-full max-w-[94rem] flex-col gap-4 px-4 py-4 md:px-8 md:py-5">
        <div className="flex items-center justify-between gap-3">
          <div className="relative hidden max-w-xl flex-1 items-center md:flex">
            <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Поиск контента, брендов и публикаций..."
              className="h-10 border-border bg-card pl-10 pr-12"
            />
            <span className="pointer-events-none absolute right-3 rounded-md border border-border bg-secondary px-1.5 py-0.5 text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              ⌘K
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="icon" aria-label="Уведомления">
              <Bell className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Создать
            </Button>
          </div>
        </div>

        <nav className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'whitespace-nowrap rounded-xl px-3 py-2 text-[0.875rem] font-medium transition-all',
                  isActive
                    ? 'bg-secondary text-foreground shadow-[var(--shadow-xs)]'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
