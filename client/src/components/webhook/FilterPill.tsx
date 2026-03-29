import { cn } from '@/lib/utils';
import styles from './FilterPill.module.css';

interface FilterPillProps {
  label: string;
  count: number;
  active?: boolean;
  onClick?: () => void;
}

export function FilterPill({ label, count, active = false, onClick }: FilterPillProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        styles.filterPill,
        active ? styles.filterPillActive : styles.filterPillInactive,
      )}
    >
      <span>{label}</span>
      <span className={active ? styles.filterPillCountActive : styles.filterPillCount}>
        {String(count).padStart(2, '0')}
      </span>
    </button>
  );
}
