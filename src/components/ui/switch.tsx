import * as React from 'react'

import { cn } from '@/lib/utils'

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  /** Более контрастная дорожка (выкл. темнее), например в длинных формах. */
  variant?: 'default' | 'emphasized'
}

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, checked = false, onCheckedChange, disabled, variant = 'default', ...props }, ref) => (
    <label
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full border transition-colors',
        variant === 'emphasized'
          ? cn(
              'border-zinc-500 bg-zinc-400',
              'shadow-[inset_0_1px_3px_rgba(15,23,42,0.18)]',
              'dark:border-zinc-500 dark:bg-zinc-600 dark:shadow-[inset_0_1px_3px_rgba(0,0,0,0.35)]'
            )
          : checked
            ? 'border-input bg-primary'
            : 'border-input bg-muted',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        className
      )}
    >
      <input
        ref={ref}
        type="checkbox"
        className="sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onCheckedChange?.(event.target.checked)}
        {...props}
      />
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full shadow-sm transition-transform',
          variant === 'emphasized'
            ? 'bg-white ring-1 ring-zinc-500/55 shadow-md dark:bg-zinc-100 dark:ring-zinc-400/75'
            : 'bg-background',
          checked ? 'translate-x-6' : 'translate-x-1'
        )}
      />
    </label>
  )
)

Switch.displayName = 'Switch'
