import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Search } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useEndpoints } from '@/hooks/useEndpoints';
import { useAuth } from '@/context/AuthContext';
import { AppHeader } from '@/components/webhook/AppHeader';
import { AppFooter } from '@/components/webhook/AppFooter';
import { FilterPill } from '@/components/webhook/FilterPill';
import { WebhookCard, OptionsButton } from '@/components/webhook/WebhookCard';
import { CreateEndpointDialog } from '@/components/dashboard/CreateEndpointDialog';
import { DeleteEndpointDialog } from '@/components/dashboard/DeleteEndpointDialog';
import { cn } from '@/lib/utils';
import { getWebhookUrl } from '@/lib/url';
import styles from './DashboardPage.module.css';

export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const {
    filteredEndpoints,
    loading,
    counts,
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    createEndpoint,
    deleteEndpoint,
    toggleActive,
  } = useEndpoints(user?.id);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [optionsOpenId, setOptionsOpenId] = useState<string | null>(null);

  const handleToggleActive = async (endpointId: string) => {
    try {
      const updated = await toggleActive(endpointId);
      if (updated) {
        toast.success(updated.isActive ? 'Endpoint enabled' : 'Endpoint disabled');
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to update endpoint';
      toast.error(msg);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteEndpoint(deleteTarget);
      setDeleteTarget(null);
      toast.success('Endpoint deleted');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to delete endpoint';
      toast.error(msg);
    }
  };

  const getEndpointStatus = (ep: { isActive: boolean }): 'active' | 'closed' =>
    ep.isActive !== false ? 'active' : 'closed';

  return (
    <div className={styles.dashboard}>
      <AppHeader />

      {/* Action Bar */}
      <div className="action-bar">
        {/* Left: status message */}
        <span className="action-bar__status">
          Application is ready to use
        </span>

        {/* Spacer */}
        <div className="action-bar__spacer" />

        {/* Right group: search + ADD NEW */}
        <div className="action-bar__right">
          <div className="action-bar__search-wrap">
            <Search className="action-bar__search-icon" />
            <input
              type="text"
              placeholder="search by webhook"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="action-bar__search-input"
            />
          </div>
          <button
            onClick={() => setCreateDialogOpen(true)}
            className="action-bar__add-btn"
          >
            ADD NEW
          </button>
        </div>
      </div>

      {/* Main body (white background) */}
      <div className={styles.dashboardBody}>
        {/* Filter pills */}
        <div className={styles.dashboardFilters}>
          <FilterPill
            label="All"
            count={counts.all}
            active={filter === 'all'}
            onClick={() => setFilter('all')}
          />
          <FilterPill
            label="Active"
            count={counts.active}
            active={filter === 'active'}
            onClick={() => setFilter('active')}
          />
          <FilterPill
            label="Closed"
            count={counts.closed}
            active={filter === 'closed'}
            onClick={() => setFilter('closed')}
          />
        </div>

        {/* Endpoint list */}
        <main className={styles.dashboardList}>
          {loading ? (
            <div className={styles.dashboardEmpty}>
              <div className={styles.dashboardEmptyText}>Loading endpoints...</div>
            </div>
          ) : filteredEndpoints.length === 0 ? (
            <div className={styles.dashboardEmpty}>
              <p className={styles.dashboardEmptyText}>
                {searchQuery || filter !== 'all'
                  ? 'No endpoints match your filter.'
                  : 'No endpoints yet. Create your first one!'}
              </p>
              {!searchQuery && filter === 'all' && (
                <button
                  onClick={() => setCreateDialogOpen(true)}
                  className="action-bar__add-btn"
                >
                  ADD NEW
                </button>
              )}
            </div>
          ) : (
            <div className={styles.dashboardCards}>
              {filteredEndpoints.map((ep) => {
                const status = getEndpointStatus(ep);
                return (
                  <DropdownMenu
                    key={ep.id}
                    open={optionsOpenId === ep.id}
                    onOpenChange={(open) => setOptionsOpenId(open ? ep.id : null)}
                  >
                    <WebhookCard
                      name={ep.name}
                      url={getWebhookUrl(ep.id)}
                      createdAt={ep.createdAt}
                      status={status}
                      stats={0}
                      hasStatusDot={status === 'active'}
                      onClick={() => navigate(`/dashboard/endpoint/${ep.id}`)}
                      optionsSlot={
                        <DropdownMenuTrigger asChild>
                          <OptionsButton
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                          />
                        </DropdownMenuTrigger>
                      }
                    />
                    <DropdownMenuContent align="end" sideOffset={4}>
                      <DropdownMenuItem
                        className={styles.dashboardMenuItem}
                        onClick={() => {
                          setOptionsOpenId(null);
                          navigate(`/dashboard/endpoint/${ep.id}/script`);
                        }}
                      >
                        Edit Script
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className={styles.dashboardMenuItem}
                        onClick={() => {
                          setOptionsOpenId(null);
                          handleToggleActive(ep.id);
                        }}
                      >
                        {status === 'active' ? 'Disable' : 'Enable'}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className={cn(styles.dashboardMenuItem, styles.dashboardMenuItemDanger)}
                        onClick={() => {
                          setOptionsOpenId(null);
                          setDeleteTarget(ep.id);
                        }}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              })}
            </div>
          )}
        </main>
      </div>

      <AppFooter />

      <CreateEndpointDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={createEndpoint}
      />

      <DeleteEndpointDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        endpointName=""
        onConfirm={handleDelete}
      />
    </div>
  );
}
