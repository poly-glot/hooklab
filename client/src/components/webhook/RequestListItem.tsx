import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MethodBadge } from './MethodBadge';
import styles from './RequestListItem.module.css';

interface RequestListItemProps {
  method: string;
  label: string;
  time: string;
  active?: boolean;
  onClick?: () => void;
  onDelete?: () => void;
}

export function RequestListItem({
  method,
  label,
  time,
  active = false,
  onClick,
  onDelete,
}: RequestListItemProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); }}
      className={cn(
        styles.requestListItem,
        active && styles.requestListItemActive,
      )}
    >
      <MethodBadge method={method} inactive={!active} />
      <span className={styles.requestListItemLabel}>{label}</span>
      <span className={styles.requestListItemTime}>{time}</span>
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className={styles.requestListItemDelete}
          aria-label="Delete request"
        >
          <Trash2 className={styles.requestListItemDeleteIcon} />
        </button>
      )}
    </div>
  );
}
