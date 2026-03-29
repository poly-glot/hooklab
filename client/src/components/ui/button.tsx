import * as React from "react"
import { Slot } from "@radix-ui/react-slot"

import { cn } from "@/lib/utils"
import styles from "./button.module.css"

const variantStyles = {
  default: "",
  destructive: styles.uiBtnDestructive,
  outline: styles.uiBtnOutline,
  secondary: styles.uiBtnSecondary,
  ghost: styles.uiBtnGhost,
  link: styles.uiBtnLink,
} as const

const sizeStyles = {
  default: "",
  sm: styles.uiBtnSm,
  lg: styles.uiBtnLg,
  icon: styles.uiBtnIcon,
} as const

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(
          styles.uiBtn,
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
