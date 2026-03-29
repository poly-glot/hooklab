import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Copy, RefreshCw, Code2 } from 'lucide-react';
import { useEndpoint } from '@/hooks/useEndpoint';
import { useClipboard } from '@/hooks/useClipboard';
import { AppHeader } from '@/components/webhook/AppHeader';
import { AppFooter } from '@/components/webhook/AppFooter';
import { ScriptEditor } from './ScriptEditor';
import { getWebhookUrl } from '@/lib/url';
import styles from './ScriptEditorPage.module.css';

export function ScriptEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { endpoint, setEndpoint, loading, refetch } = useEndpoint(id);
  const { copy: copyUrl } = useClipboard(2000);

  const webhookUrl = endpoint ? getWebhookUrl(endpoint.id) : '';

  if (loading) {
    return (
      <div className={styles.scriptPage}>
        <AppHeader />
        <div className={styles.scriptPageCenter}>
          <RefreshCw className={styles.scriptPageLoadingIcon} />
        </div>
        <AppFooter />
      </div>
    );
  }

  if (!endpoint) {
    return (
      <div className={styles.scriptPage}>
        <AppHeader />
        <div className={`${styles.scriptPageCenter} ${styles.scriptPageCenterCol}`}>
          <p className={styles.scriptPageNotFoundText}>Endpoint not found</p>
          <button
            onClick={() => navigate('/dashboard')}
            className={styles.scriptPageBackBtn}
          >
            Back to Dashboard
          </button>
        </div>
        <AppFooter />
      </div>
    );
  }

  return (
    <div className={styles.scriptPage}>
      <AppHeader />

      {/* Action Bar — matches EndpointDetail pattern */}
      <div className={styles.scriptPageActionBar}>
        {/* Left: Back to endpoint — positioned at left:13px */}
        <button
          onClick={() => navigate(`/dashboard/endpoint/${endpoint.id}`)}
          className={styles.scriptPageBackLink}
        >
          <ArrowLeft className={styles.scriptPageBackLinkIcon} />
          <span className={styles.scriptPageBackLinkText}>Back to endpoint</span>
        </button>

        {/* Toolbar block — starts at sidebar boundary (320px from left) */}
        <div className={styles.scriptPageToolbar}>
          {/* Script Editor label */}
          <div className={styles.scriptPageToolbarLabel}>
            <Code2 className={styles.scriptPageToolbarLabelIcon} />
            <span>Script Editor</span>
          </div>

          {/* Vertical separator */}
          <div className={styles.scriptPageToolbarSep} />

          {/* URL display */}
          <span className={styles.scriptPageToolbarUrl}>
            {webhookUrl}
          </span>

          {/* Copy button */}
          <button
            onClick={() => copyUrl(webhookUrl)}
            className={styles.scriptPageToolbarCopy}
          >
            <Copy className={styles.scriptPageToolbarCopyIcon} />
            <span>Copy</span>
          </button>
        </div>

        {/* Mobile: simplified toolbar */}
        <div className={styles.scriptPageToolbarMobile}>
          <div className={styles.scriptPageToolbarMobileLabel}>
            <Code2 className={styles.scriptPageToolbarMobileLabelIcon} />
          </div>
          <span className={styles.scriptPageToolbarMobileUrl}>
            {webhookUrl}
          </span>
          <button
            onClick={() => copyUrl(webhookUrl)}
            className={styles.scriptPageToolbarMobileCopy}
          >
            <Copy className={styles.scriptPageToolbarMobileCopyIcon} />
          </button>
        </div>

        {/* Right: Refresh — pushed to far right */}
        <div className={styles.scriptPageActionRight}>
          <button
            onClick={() => {
              if (!id) return;
              refetch();
              toast.success('Refreshed');
            }}
            className={styles.scriptPageRefreshBtn}
          >
            <RefreshCw className={styles.scriptPageRefreshBtnIcon} />
            Refresh
          </button>
        </div>
      </div>

      {/* Script Editor content — full height two-column layout */}
      <div className={styles.scriptPageContent}>
        <ScriptEditor
          endpoint={endpoint}
          onUpdate={(updated) => setEndpoint(updated)}
        />
      </div>

      <AppFooter />
    </div>
  );
}
