import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useEndpoint } from '@/hooks/useEndpoint';
import { useExecutions } from '@/hooks/useExecutions';
import { useEndpointEdit } from '@/hooks/useEndpointEdit';
import { useClipboard } from '@/hooks/useClipboard';
import { AppHeader } from '@/components/webhook/AppHeader';
import { AppFooter } from '@/components/webhook/AppFooter';
import { RequestListItem } from '@/components/webhook/RequestListItem';
import { EndpointActionBar } from '@/components/endpoint/EndpointActionBar';
import { EndpointEditPanel } from '@/components/endpoint/EndpointEditPanel';
import { RequestDetailTabs } from '@/components/endpoint/RequestDetailTabs';
import { cn } from '@/lib/utils';
import { formatTimeSidebar } from '@/lib/format';
import { getWebhookUrl } from '@/lib/url';
import styles from './EndpointDetail.module.css';

type DetailTab = 'header' | 'body' | 'query' | 'response';

const REQUESTS_PER_PAGE = 20;

export function EndpointDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { endpoint, loading, refetch, updateEndpoint } = useEndpoint(id);
  const {
    requests,
    selectedRequest,
    setSelectedRequest,
    clearAll,
    deleteOne,
    paginatedRequests,
    currentPage,
    setCurrentPage,
    totalPages,
  } = useExecutions(id, endpoint?.isActive !== false);

  const { editing, editFields, setEditField, startEdit, saveEdit, cancelEdit, saving } =
    useEndpointEdit(endpoint, async (fields) => {
      await updateEndpoint(fields);
    });

  const { copy: copyUrl } = useClipboard(2000);

  const [activeTab, setActiveTab] = useState<DetailTab>('header');
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const webhookUrl = endpoint ? getWebhookUrl(endpoint.id) : '';

  const handleClearRequests = async () => {
    if (!id) return;
    try {
      setClearing(true);
      await clearAll();
      setClearDialogOpen(false);
    } catch {
      // error already toasted in hook
    } finally {
      setClearing(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.endpointDetail}>
        <AppHeader />
        <div className={styles.endpointDetailCenter}>
          <RefreshCw className={styles.endpointDetailLoadingIcon} />
        </div>
        <AppFooter />
      </div>
    );
  }

  if (!endpoint) {
    return (
      <div className={styles.endpointDetail}>
        <AppHeader />
        <div className={styles.endpointDetailCenter}>
          <p className={styles.endpointDetailNotFoundText}>Endpoint not found</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="btn btn--primary"
          >
            Back to Dashboard
          </button>
        </div>
        <AppFooter />
      </div>
    );
  }

  return (
    <div className={styles.endpointDetail}>
      <AppHeader />

      <EndpointActionBar
        webhookUrl={webhookUrl}
        endpointId={endpoint.id}
        isActive={endpoint.isActive !== false}
        onToggleLive={async () => {
          const newActive = endpoint.isActive === false ? true : false;
          await updateEndpoint({ isActive: newActive });
        }}
        onEdit={startEdit}
        onRefresh={() => { if (id) refetch(); }}
        onCopyUrl={() => copyUrl(webhookUrl)}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
      />

      {editing && (
        <EndpointEditPanel
          editFields={editFields}
          setEditField={setEditField}
          saving={saving}
          onSave={saveEdit}
          onCancel={cancelEdit}
        />
      )}

      {/* Main body */}
      <div className={styles.endpointDetailBody}>
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            role="button"
            tabIndex={0}
            className={styles.sidebarOverlay}
            onClick={() => setSidebarOpen(false)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSidebarOpen(false); }}
          />
        )}

        {/* Sidebar: request list */}
        <aside className={cn(styles.sidebar, sidebarOpen && styles.sidebarOpen)}>
          <div className={styles.sidebarList} data-testid="request-list">
            {requests.length === 0 ? null : (
              paginatedRequests.map((req, idx) => (
                <RequestListItem
                  key={req.id}
                  method={req.method}
                  label={`Request #${currentPage * REQUESTS_PER_PAGE + idx + 1}`}
                  time={formatTimeSidebar(req.timestamp)}
                  active={selectedRequest?.id === req.id}
                  onClick={() => {
                    setSelectedRequest(req);
                    setSidebarOpen(false);
                  }}
                  onDelete={() => deleteOne(req.id)}
                />
              ))
            )}
          </div>

          {totalPages > 1 && (
            <div className={styles.sidebarPagination} data-testid="pagination">
              <button
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className={styles.sidebarPaginationBtn}
                data-testid="pagination-prev"
              >
                <ChevronLeft className={styles.sidebarPaginationIcon} />
              </button>
              <span className={styles.sidebarPaginationText}>
                Page {currentPage + 1} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage >= totalPages - 1}
                className={styles.sidebarPaginationBtn}
                data-testid="pagination-next"
              >
                <ChevronRight className={styles.sidebarPaginationIcon} />
              </button>
            </div>
          )}

          <div className={styles.sidebarDeleteWrap}>
            <button
              onClick={() => setClearDialogOpen(true)}
              disabled={requests.length === 0}
              className={styles.sidebarDeleteBtn}
              data-testid="clear-all-button"
            >
              DELETE ALL
            </button>
          </div>
        </aside>

        {/* Content area */}
        <RequestDetailTabs
          selectedRequest={selectedRequest}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          hasRequests={requests.length > 0}
          webhookUrl={webhookUrl}
        />
      </div>

      <AppFooter />

      {/* Clear all confirmation */}
      <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete All Requests</DialogTitle>
            <DialogDescription>
              This will permanently delete all request logs for this endpoint. This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setClearDialogOpen(false)}
              disabled={clearing}
              className="btn btn--outline"
            >
              Cancel
            </button>
            <button
              onClick={handleClearRequests}
              disabled={clearing}
              className="btn btn--danger"
            >
              {clearing ? 'Deleting...' : 'Delete All'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
