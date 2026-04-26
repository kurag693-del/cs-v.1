import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-[0.9375rem] font-medium tracking-[-0.01em] transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-[var(--shadow-focus)] disabled:pointer-events-none disabled:opacity-50 active:scale-[0.99] active:brightness-[0.985] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border border-white/40 bg-white/80 text-foreground shadow-[var(--shadow-sm)] backdrop-blur-md hover:bg-white/90 hover:shadow-[var(--shadow-md)] dark:border-white/10 dark:bg-white/10 dark:text-foreground dark:hover:bg-white/14",
        destructive:
          "border border-destructive/30 bg-destructive/90 text-destructive-foreground shadow-[var(--shadow-xs)] hover:brightness-95",
        outline:
          "border border-border/90 bg-background/75 text-foreground shadow-[var(--shadow-xs)] backdrop-blur-sm hover:bg-secondary hover:shadow-[var(--shadow-sm)]",
        secondary:
          "border border-border/80 bg-secondary/75 text-secondary-foreground shadow-[var(--shadow-xs)] backdrop-blur-sm hover:bg-secondary hover:shadow-[var(--shadow-sm)]",
        ghost: "text-muted-foreground hover:bg-secondary hover:text-foreground",
        link: "h-auto rounded-none p-0 text-foreground underline-offset-4 hover:text-foreground/80 hover:underline",
      },
      size: {
        default: "h-10 px-5",
        sm: "h-9 px-4 text-[0.8125rem]",
        lg: "h-11 px-7 text-base",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
