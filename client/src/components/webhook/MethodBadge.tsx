import { cn } from '@/lib/utils';
import styles from './MethodBadge.module.css';

interface MethodBadgeProps {
  method: string;
  inactive?: boolean;
}

export function MethodBadge({ method, inactive = false }: MethodBadgeProps) {
  return (
    <span
      className={cn(
        styles.methodBadge,
        inactive ? styles.methodBadgeInactive : styles.methodBadgeActive,
      )}
    >
      {method.toUpperCase()}
    </span>
  );
}
