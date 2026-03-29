import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Copy, RefreshCw, Menu, Pencil, Code2 } from 'lucide-react';

interface EndpointActionBarProps {
  webhookUrl: string;
  endpointId: string;
  isActive: boolean;
  onToggleLive: () => void;
  onEdit: () => void;
  onRefresh: () => void;
  onCopyUrl: () => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export function EndpointActionBar({
  webhookUrl,
  endpointId,
  isActive,
  onToggleLive,
  onEdit,
  onRefresh,
  onCopyUrl,
  onToggleSidebar,
}: EndpointActionBarProps) {
  const navigate = useNavigate();

  return (
    <div className="action-bar action-bar--detail">
      {/* Mobile sidebar toggle */}
      <button
        onClick={onToggleSidebar}
        className="action-bar__mobile-toggle"
      >
        <Menu className="action-bar__mobile-toggle-icon" />
      </button>

      {/* Left: Back to listing */}
      <button
        onClick={() => navigate('/dashboard')}
        className="action-bar__back"
        data-testid="back-button"
      >
        <ArrowLeft className="action-bar__back-icon" />
        <span className="action-bar__back-text">Back to listing</span>
      </button>

      {/* Toolbar block */}
      <div className="action-bar__toolbar">
        <button
          onClick={onEdit}
          className="action-bar__toolbar-btn"
          data-testid="edit-button"
        >
          <Pencil className="action-bar__toolbar-btn-icon" />
          <span>Edit</span>
        </button>

        <div className="action-bar__toolbar-sep" />

        <span className="action-bar__toolbar-url">{webhookUrl}</span>

        <button onClick={onCopyUrl} className="action-bar__toolbar-btn">
          <Copy className="action-bar__toolbar-btn-icon" />
          <span>Copy</span>
        </button>
      </div>

      {/* Mobile: simplified toolbar */}
      <div className="action-bar__toolbar-mobile">
        <button
          onClick={onEdit}
          className="action-bar__toolbar-btn action-bar__toolbar-btn--mobile"
          data-testid="edit-button-mobile"
        >
          <Pencil className="action-bar__toolbar-btn-icon--mobile" />
        </button>
        <span className="action-bar__toolbar-url--mobile">{webhookUrl}</span>
        <button
          onClick={onCopyUrl}
          className="action-bar__toolbar-btn action-bar__toolbar-btn--mobile"
        >
          <Copy className="action-bar__toolbar-btn-icon--mobile" />
        </button>
      </div>

      {/* Right: Live + Script Editor + Refresh */}
      <div className="action-bar__actions">
        <button
          onClick={onToggleLive}
          className={`action-bar__live ${isActive ? 'action-bar__live--on' : 'action-bar__live--off'}`}
        >
          <span className={`action-bar__live-dot ${isActive ? 'action-bar__live-dot--on' : 'action-bar__live-dot--off'}`} />
          {isActive ? 'Live' : 'Off'}
        </button>

        <button
          onClick={() => navigate(`/dashboard/endpoint/${endpointId}/script`)}
          className="btn btn--outline-sm"
        >
          <Code2 className="btn__icon" />
          Script Editor
        </button>

        <button
          onClick={() => {
            onRefresh();
            toast.success('Refreshed');
          }}
          className="btn btn--outline-sm"
        >
          <RefreshCw className="btn__icon" />
          Refresh
        </button>
      </div>
    </div>
  );
}
