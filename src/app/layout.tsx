import type { Metadata } from 'next'
import { Geist, Inter } from 'next/font/google'
import './globals.css'
import { cn } from '@/lib/utils'

const geist = Geist({ subsets: ['latin'], variable: '--font-display' })
const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'Креатив-студия — ИИ для контента в соцсетях',
  description:
    'Генерация постов, календарь публикаций, бренд-голос и аналитика в одной платформе.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body
        className={cn(
          geist.variable,
          inter.variable,
          'min-h-screen bg-background font-sans antialiased'
        )}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  )
}
