import { Copy, Check } from 'lucide-react';
import { useClipboard } from '@/hooks/useClipboard';
import styles from './WaitingState.module.css';

interface WaitingStateProps {
  webhookUrl: string;
}

export function WaitingState({ webhookUrl }: WaitingStateProps) {
  const { copy, copied } = useClipboard(2000);

  const curlExample = `curl -X POST ${webhookUrl} \\
  -H "Content-Type: application/json" \\
  -d '{"event": "test", "data": {"key": "value"}}'`;

  const handleCopy = () => {
    copy(curlExample.replace(/\\\n/g, ''));
  };

  return (
    <div className={styles.waitingState}>
      <div className={styles.waitingStateSpinner} />
      <p className={styles.waitingStateTitle}>Waiting for first webhook...</p>
      <p className={styles.waitingStateSubtitle}>Send a request to your webhook URL to see it here.</p>
      <div className={styles.waitingStateCurl}>
        <div className={styles.waitingStateCurlHeader}>
          <span className={styles.waitingStateCurlLabel}>Example request</span>
          <button onClick={handleCopy} className={styles.waitingStateCurlCopy}>
            {copied ? <Check className={styles.waitingStateCurlCopyIcon} /> : <Copy className={styles.waitingStateCurlCopyIcon} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <pre className={styles.waitingStateCurlCode}>{curlExample}</pre>
      </div>
    </div>
  );
}
