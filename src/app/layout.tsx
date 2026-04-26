import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { cn } from '@/lib/utils'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'Креатив-студия — AI Content Studio',
  description: 'AI-powered social media content generation platform',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
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
