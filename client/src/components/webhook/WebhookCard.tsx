import { forwardRef, type ReactNode } from 'react';
import { Calendar, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import styles from './WebhookCard.module.css';

interface WebhookCardProps {
  name: string;
  url: string;
  createdAt: string;
  status: 'active' | 'closed';
  stats: number;
  hasStatusDot?: boolean;
  onClick?: () => void;
  /** Slot to render a custom trigger (e.g. DropdownMenuTrigger) in place of the default options button */
  optionsSlot?: ReactNode;
  onOptionsClick?: (e: React.MouseEvent) => void;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const day = d.getDate();
    const month = d.toLocaleString('en-US', { month: 'long' });
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return dateStr;
  }
}

/** The "..." options button -- forwardRef so Radix DropdownMenuTrigger can attach to it */
export const OptionsButton = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(function OptionsButton(props, ref) {
  return (
    <button
      ref={ref}
      type="button"
      {...props}
      className={cn(styles.webhookCardOptionsBtn, props.className)}
      aria-label="Options"
    >
      <MoreHorizontal className={styles.webhookCardOptionsIcon} />
    </button>
  );
});

export function WebhookCard({
  name,
  url,
  createdAt,
  status,
  stats,
  hasStatusDot = false,
  onClick,
  optionsSlot,
  onOptionsClick,
}: WebhookCardProps) {
  const isActive = status === 'active';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); }}
      className={styles.webhookCard}
      data-testid="endpoint-card"
    >
      {/* Status dot */}
      {hasStatusDot && (
        <span className={styles.webhookCardDot} data-testid="status-dot" />
      )}

      {/* Name + URL */}
      <div className={styles.webhookCardInfo}>
        <p className={styles.webhookCardName}>{name}</p>
        <p className={styles.webhookCardUrl}>{url}</p>
      </div>

      {/* Spacer */}
      <div className={styles.webhookCardSpacer} />

      {/* Created on */}
      <div className={styles.webhookCardCreated}>
        <div className={styles.webhookCardCreatedIconWrap}>
          <Calendar className={styles.webhookCardCreatedIcon} />
        </div>
        <div>
          <p className={styles.webhookCardMetaLabel}>Created on</p>
          <p className={styles.webhookCardMetaValue}>{formatDate(createdAt)}</p>
        </div>
      </div>

      {/* Status */}
      <div className={styles.webhookCardStatus}>
        <p className={styles.webhookCardMetaLabel}>Status</p>
        <div className={styles.webhookCardStatusRow}>
          {isActive && (
            <span className={styles.webhookCardStatusDot} />
          )}
          <p className={isActive ? styles.webhookCardStatusTextActive : styles.webhookCardStatusTextClosed}>
            {isActive ? 'Active' : 'Closed'}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className={styles.webhookCardStats}>
        <p className={styles.webhookCardMetaLabel}>Stats</p>
        <p className={styles.webhookCardMetaValue}>{stats}</p>
      </div>

      {/* Spacer */}
      <div className={styles.webhookCardSpacer} />

      {/* Options -- either custom slot or default button */}
      {optionsSlot ?? (
        <OptionsButton
          onClick={(e) => {
            e.stopPropagation();
            onOptionsClick?.(e);
          }}
        />
      )}
    </div>
  );
}
