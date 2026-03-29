import { RequestLog } from '@/lib/api';

export function formatTime(ts: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date(ts));
  } catch {
    return ts;
  }
}

export function formatTimeSidebar(ts: string): string {
  try {
    const now = new Date();
    const date = new Date(ts);
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays >= 1) return 'Yesterday';
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return ts;
  }
}

export function formatDateFull(ts: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ts));
  } catch {
    return ts;
  }
}

export function prettyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

/** Syntax-highlight JSON string into HTML spans */
export function highlightJson(raw: string): string {
  const pretty = prettyJson(raw);
  // Escape HTML first
  const escaped = pretty
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // Apply syntax highlighting
  return escaped.replace(
    /("(?:\\.|[^"\\])*")\s*:/g,
    '<span class="json-pretty__key">$1</span>:'
  ).replace(
    /:\s*("(?:\\.|[^"\\])*")/g,
    ': <span class="json-pretty__string">$1</span>'
  ).replace(
    /:\s*(\d+\.?\d*)/g,
    ': <span class="json-pretty__number">$1</span>'
  ).replace(
    /:\s*(true|false)/g,
    ': <span class="json-pretty__boolean">$1</span>'
  ).replace(
    /:\s*(null)/g,
    ': <span class="json-pretty__null">$1</span>'
  );
}

export function getStatusColorClass(
  status: number,
  statusStyles: Record<string, string>,
): string {
  if (status >= 200 && status < 300) return statusStyles.statusBadgeSuccess;
  if (status >= 400 && status < 500) return statusStyles.statusBadgeWarning;
  if (status >= 500) return statusStyles.statusBadgeError;
  return '';
}

export function generateCurlCommand(req: RequestLog): string {
  const lines: string[] = [`curl -X ${req.method} '${req.url}'`];
  for (const [key, value] of Object.entries(req.headers)) {
    lines.push(`  -H '${key}: ${value}'`);
  }
  if (req.body) {
    lines.push(`  -d '${req.body}'`);
  }
  return lines.join(' \\\n');
}

export function generateFetchCommand(req: RequestLog): string {
  const options: Record<string, unknown> = {
    method: req.method,
  };
  if (Object.keys(req.headers).length > 0) {
    options.headers = req.headers;
  }
  if (req.body) {
    options.body = req.body;
  }
  return `fetch('${req.url}', ${JSON.stringify(options, null, 2)})
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));`;
}
