import { RequestLog } from '@/lib/api';
import {
  formatTime,
  formatDateFull,
  highlightJson,
  getStatusColorClass,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import { ExportDropdown } from './ExportDropdown';
import { WaitingState } from './WaitingState';
import styles from './RequestDetailTabs.module.css';

type DetailTab = 'header' | 'body' | 'query' | 'response';

interface KVRowProps {
  label: string;
  value: string;
}

function KVRow({ label, value }: KVRowProps) {
  return (
    <div className={styles.kvRow}>
      <span className={styles.kvRowLabel}>{label}</span>
      <span className={styles.kvRowValue}>{value}</span>
    </div>
  );
}

interface RequestDetailTabsProps {
  selectedRequest: RequestLog | null;
  activeTab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  hasRequests: boolean;
  webhookUrl: string;
}

export function RequestDetailTabs({
  selectedRequest,
  activeTab,
  onTabChange,
  hasRequests,
  webhookUrl,
}: RequestDetailTabsProps) {
  const headerRows: KVRowProps[] = selectedRequest
    ? [
        { label: 'Host', value: (() => { try { return new URL(selectedRequest.url).host; } catch { return '-'; } })() },
        { label: 'Method', value: selectedRequest.method },
        { label: 'Date', value: formatDateFull(selectedRequest.timestamp) },
        { label: 'Size', value: selectedRequest.body ? `${new Blob([selectedRequest.body]).size} Bytes` : '0 Bytes' },
        { label: 'Time', value: formatTime(selectedRequest.timestamp) },
        { label: 'ID', value: selectedRequest.id },
        ...Object.entries(selectedRequest.headers).map(([k, v]) => ({ label: k, value: v })),
      ]
    : [];

  const queryRows: KVRowProps[] = selectedRequest
    ? Object.entries(selectedRequest.query || {}).map(([k, v]) => ({ label: k, value: v }))
    : [];

  return (
    <div className={styles.detailTabs}>
      {selectedRequest ? (
        <>
          {/* Tab list */}
          <div className={styles.detailTabsBar}>
            <div className={styles.detailTabsTabs}>
              {(['header', 'body', 'query', 'response'] as DetailTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => onTabChange(tab)}
                  className={cn(styles.detailTabsTab, activeTab === tab && styles.detailTabsTabActive)}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
            <div className={styles.detailTabsBarRight}>
              <ExportDropdown request={selectedRequest} />
            </div>
          </div>

          {/* Tab content */}
          <div className={styles.detailTabsContent}>
            <div className={styles.detailTabsPane}>
              {activeTab === 'header' && (
                <div>
                  <div className={styles.kvRow}>
                    <span className={styles.kvRowLabel}>Status</span>
                    <span className={styles.kvRowValue}>
                      <span className={cn(styles.statusBadge, getStatusColorClass(selectedRequest.responseStatus, styles))}>
                        {selectedRequest.responseStatus}
                      </span>
                    </span>
                  </div>
                  {headerRows.length === 0 ? (
                    <p className={styles.detailTabsEmptyText}>No headers.</p>
                  ) : (
                    headerRows.map((row) => (
                      <KVRow key={row.label} label={row.label} value={row.value} />
                    ))
                  )}
                  {/* Add Note link */}
                  <div className={styles.kvRow}>
                    <span className={styles.kvRowLabel}>Note</span>
                    <button className={styles.kvRowAction}>Add Note</button>
                  </div>
                </div>
              )}

              {activeTab === 'body' && (
                <div>
                  {selectedRequest.body ? (
                    <pre
                      className="json-pretty"
                      dangerouslySetInnerHTML={{
                        __html: highlightJson(selectedRequest.body),
                      }}
                    />
                  ) : (
                    <p className={styles.detailTabsEmptyText}>No body.</p>
                  )}
                </div>
              )}

              {activeTab === 'query' && (
                <div>
                  {queryRows.length === 0 ? (
                    <p className={styles.detailTabsEmptyText}>No query parameters.</p>
                  ) : (
                    queryRows.map((row) => (
                      <KVRow key={row.label} label={row.label} value={row.value} />
                    ))
                  )}
                </div>
              )}

              {activeTab === 'response' && (
                <div>
                  <div className={styles.kvRow}>
                    <span className={styles.kvRowLabel}>Status</span>
                    <span className={styles.kvRowValue}>
                      <span className={cn(styles.statusBadge, getStatusColorClass(selectedRequest.responseStatus, styles))}>
                        {selectedRequest.responseStatus}
                      </span>
                    </span>
                  </div>
                  {selectedRequest.responseBody && (
                    <div className={styles.detailTabsResponseBody}>
                      <p className={styles.detailTabsResponseLabel}>Response Body</p>
                      <pre
                        className="json-pretty"
                        dangerouslySetInnerHTML={{
                          __html: highlightJson(selectedRequest.responseBody),
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className={styles.detailTabsEmpty}>
          {hasRequests ? (
            <p className={styles.detailTabsEmptyMsg}>
              Select a request from the sidebar to view details.
            </p>
          ) : (
            <WaitingState webhookUrl={webhookUrl} />
          )}
        </div>
      )}
    </div>
  );
}
