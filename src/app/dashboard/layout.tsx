'use client'

import { AuthProvider } from '@/lib/auth/hooks'
import { DashboardTopNav } from '@/components/layout/DashboardTopNav'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-background">
        <DashboardTopNav />
        {children}
      </div>
    </AuthProvider>
  )
}
