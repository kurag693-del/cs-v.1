import * as React from 'react'

import { cn } from '@/lib/utils'

export function Command({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground', className)} {...props} />
}

export function CommandInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex items-center border-b px-3">
      <input className={cn('flex h-10 w-full bg-transparent py-3 text-sm outline-none', className)} {...props} />
    </div>
  )
}

export function CommandEmpty({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('py-6 text-center text-sm', className)} {...props} />
}

export function CommandGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('overflow-hidden p-1', className)} {...props} />
}

interface CommandItemProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  onSelect?: (value: string) => void
  value?: string
}

export function CommandItem({ className, onSelect, value = '', onClick, ...props }: CommandItemProps) {
  return (
    <div
      className={cn('relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground', className)}
      onClick={(event) => {
        onClick?.(event)
        onSelect?.(value)
      }}
      {...props}
    />
  )
}
