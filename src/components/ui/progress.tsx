import * as React from 'react'

import { cn } from '@/lib/utils'

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
}

export function Progress({ className, value = 0, ...props }: ProgressProps) {
  const safeValue = Math.max(0, Math.min(100, value))

  return (
    <div
      className={cn(
        'relative h-2.5 w-full overflow-hidden rounded-full border border-border bg-secondary',
        className
      )}
      {...props}
    >
      <div
        className="h-full rounded-full bg-primary shadow-[0_0_20px_rgb(91_92_230_/_0.26)] transition-all duration-300 ease-out"
        style={{ width: `${safeValue}%` }}
      />
    </div>
  )
}
