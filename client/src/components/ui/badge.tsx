import * as React from "react"

import { cn } from "@/lib/utils"
import styles from "./badge.module.css"

const variantStyles = {
  default: "",
  secondary: styles.uiBadgeSecondary,
  destructive: styles.uiBadgeDestructive,
  outline: styles.uiBadgeOutline,
} as const

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        styles.uiBadge,
        variantStyles[variant],
        className
      )}
      {...props}
    />
  )
}

export { Badge }
