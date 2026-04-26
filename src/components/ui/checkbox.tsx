import * as React from 'react'

import { cn } from '@/lib/utils'

type CheckedState = boolean

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  checked?: CheckedState
  onCheckedChange?: (checked: CheckedState) => void
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, ...props }, ref) => (
    <input
      ref={ref}
      type="checkbox"
      className={cn('h-4 w-4 rounded border border-input accent-primary', className)}
      checked={checked}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
      {...props}
    />
  )
)
Checkbox.displayName = 'Checkbox'
