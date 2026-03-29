import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { ChevronDown } from 'lucide-react';
import { RequestLog } from '@/lib/api';
import { generateCurlCommand, generateFetchCommand } from '@/lib/format';
import styles from './ExportDropdown.module.css';

interface ExportDropdownProps {
  request: RequestLog;
}

export function ExportDropdown({ request }: ExportDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleCopyCurl = () => {
    navigator.clipboard.writeText(generateCurlCommand(request));
    toast.success('cURL command copied');
    setOpen(false);
  };

  const handleCopyFetch = () => {
    navigator.clipboard.writeText(generateFetchCommand(request));
    toast.success('Fetch code copied');
    setOpen(false);
  };

  return (
    <div className={styles.exportDropdown} ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={styles.exportDropdownTrigger}
      >
        Export
        <ChevronDown className={styles.exportDropdownChevron} />
      </button>
      {open && (
        <div className={styles.exportDropdownMenu}>
          <button onClick={handleCopyCurl} className={styles.exportDropdownItem}>
            Copy as cURL
          </button>
          <button onClick={handleCopyFetch} className={styles.exportDropdownItem}>
            Copy as Fetch
          </button>
        </div>
      )}
    </div>
  );
}
