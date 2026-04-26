'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Главная' },
  { href: '/dashboard/brands', label: 'Бренды' },
  { href: '/dashboard/generate', label: 'Генерация' },
  { href: '/dashboard/calendar', label: 'Календарь' },
  { href: '/dashboard/analytics', label: 'Аналитика' },
  { href: '/pricing', label: 'Тарифы' },
] as const

export function DashboardTopNav() {
  const pathname = usePathname()

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-2 overflow-x-auto px-4 py-3 md:px-8">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'rounded-md px-3 py-2 text-sm transition-colors whitespace-nowrap',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </div>
    </header>
  )
}
