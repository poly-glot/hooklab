import { useState, useRef, useEffect } from 'react';
import {
  Send,
  Database,
  Zap,
  ChevronDown,
  ChevronUp,
  Download,
  Sparkles,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  MessageSquare,
} from 'lucide-react';
import { AppHeader } from '@/components/webhook/AppHeader';
import { AppFooter } from '@/components/webhook/AppFooter';
import { useReports, type ChatMessage } from '@/hooks/useReports';
import { cn } from '@/lib/utils';
import type {
  ReportDuration,
  ReportFormat,
  ReportQueryResponse,
  TableOutput,
  ChartOutput,
} from '@/lib/api';
import type { Conversation } from '@/lib/chat-store';
import styles from './ReportsPage.module.css';

const DURATIONS: { value: ReportDuration; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '180d', label: '180 days' },
];

const FORMATS: { value: ReportFormat; label: string }[] = [
  { value: 'table', label: 'Table' },
  { value: 'csv', label: 'CSV' },
  { value: 'json', label: 'JSON' },
  { value: 'chart', label: 'Chart' },
  { value: 'summary', label: 'Summary' },
];

const SUGGESTIONS = [
  'How many webhooks did I get this week?',
  'Show me the slowest requests',
  'Error rate by endpoint',
  'Show request volume over time as a chart',
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Report data renderers ──────────────────────────────────────────

function ReportTableView({ data }: { data: TableOutput }) {
  if (!data.columns || !data.rows) return null;
  return (
    <div className={styles.tableOverflow}>
      <table className={styles.dataTable}>
        <thead>
          <tr>
            {data.columns.map((col) => (
              <th key={col.name}>{col.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, i) => (
            <tr key={i}>
              {data.columns.map((col) => (
                <td key={col.name} title={String(row[col.name] ?? '')}>
                  {String(row[col.name] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportChartView({ data }: { data: ChartOutput }) {
  if (!data.labels || !data.datasets?.[0]) return null;
  const dataset = data.datasets[0];
  const maxVal = Math.max(...dataset.data, 1);

  return (
    <div className={styles.chartContainer}>
      {data.labels.map((label, i) => (
        <div key={i} className={styles.chartBar}>
          <span className={styles.chartBarLabel}>{label}</span>
          <div className={styles.chartBarTrack}>
            <div
              className={styles.chartBarFill}
              style={{ width: `${(dataset.data[i] / maxVal) * 100}%` }}
            />
          </div>
          <span className={styles.chartBarValue}>{dataset.data[i]}</span>
        </div>
      ))}
    </div>
  );
}

function downloadAsFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ReportDataView({ report }: { report: ReportQueryResponse }) {
  const [showSql, setShowSql] = useState(false);

  const handleDownloadCSV = () => {
    if (report.format === 'csv' && typeof report.data === 'string') {
      downloadAsFile(report.data, 'report.csv', 'text/csv');
    } else if (report.format === 'table') {
      const table = report.data as TableOutput;
      const header = table.columns.map((c) => c.name).join(',');
      const rows = table.rows.map((row) =>
        table.columns.map((c) => String(row[c.name] ?? '')).join(',')
      );
      downloadAsFile([header, ...rows].join('\n'), 'report.csv', 'text/csv');
    }
  };

  const handleDownloadJSON = () => {
    const content =
      typeof report.data === 'string'
        ? report.data
        : JSON.stringify(report.data, null, 2);
    downloadAsFile(content, 'report.json', 'application/json');
  };

  return (
    <div className={styles.reportResult}>
      <div className={styles.reportMeta}>
        <span className={styles.reportMetaItem}>
          <Database style={{ width: 10, height: 10 }} />
          {formatBytes(report.meta.bytesProcessed)} scanned
        </span>
        <span className={styles.reportMetaItem}>
          <Zap style={{ width: 10, height: 10 }} />
          {report.meta.executionTime}ms
        </span>
        <span className={styles.reportMetaItem}>
          {report.meta.rowCount} row{report.meta.rowCount !== 1 ? 's' : ''}
        </span>
      </div>

      <button className={styles.sqlToggle} onClick={() => setShowSql(!showSql)}>
        {showSql ? (
          <ChevronUp style={{ width: 12, height: 12, display: 'inline' }} />
        ) : (
          <ChevronDown style={{ width: 12, height: 12, display: 'inline' }} />
        )}{' '}
        {showSql ? 'Hide' : 'Show'} SQL
      </button>
      {showSql && <pre className={styles.sqlBlock}>{report.meta.query}</pre>}

      {report.format === 'table' || report.format === 'markdown' ? (
        <ReportTableView data={report.data as TableOutput} />
      ) : report.format === 'chart' ? (
        <ReportChartView data={report.data as ChartOutput} />
      ) : (
        <pre className={styles.textOutput}>
          {typeof report.data === 'string'
            ? report.data
            : JSON.stringify(report.data, null, 2)}
        </pre>
      )}

      <div className={styles.downloadRow}>
        <button className={styles.downloadBtn} onClick={handleDownloadCSV}>
          <Download style={{ width: 10, height: 10 }} /> CSV
        </button>
        <button className={styles.downloadBtn} onClick={handleDownloadJSON}>
          <Download style={{ width: 10, height: 10 }} /> JSON
        </button>
      </div>
    </div>
  );
}

// ── Message bubble ─────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ChatMessage }) {
  if (msg.role === 'user') {
    return (
      <div className={cn(styles.message, styles.messageUser)}>
        <div className={cn(styles.messageAvatar, styles.messageAvatarUser)}>U</div>
        <div className={cn(styles.messageBubble, styles.messageBubbleUser)}>
          {msg.content}
        </div>
      </div>
    );
  }

  if (msg.isLoading) {
    return (
      <div className={styles.message}>
        <div className={styles.messageAvatar}>
          <Sparkles style={{ width: 14, height: 14 }} />
        </div>
        <div className={cn(styles.messageBubble, styles.messageBubbleAssistant)}>
          <div className={styles.loadingDots}>
            <span className={styles.loadingDot} />
            <span className={styles.loadingDot} />
            <span className={styles.loadingDot} />
          </div>
        </div>
      </div>
    );
  }

  if (msg.error) {
    return (
      <div className={styles.message}>
        <div className={styles.messageAvatar}>
          <Sparkles style={{ width: 14, height: 14 }} />
        </div>
        <div className={cn(styles.messageBubble, styles.messageBubbleError)}>
          {msg.error}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.message}>
      <div className={styles.messageAvatar}>
        <Sparkles style={{ width: 14, height: 14 }} />
      </div>
      <div className={cn(styles.messageBubble, styles.messageBubbleAssistant)}>
        <p>{msg.content}</p>
        {msg.report && <ReportDataView report={msg.report} />}
      </div>
    </div>
  );
}

// ── Conversation sidebar item ─────────────────────────────────────

function ConversationItem({
  convo,
  isActive,
  onSelect,
  onRename,
  onDelete,
}: {
  convo: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(convo.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handleSave = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== convo.name) {
      onRename(trimmed);
    }
    setEditing(false);
  };

  const handleCancel = () => {
    setEditName(convo.name);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className={cn(styles.convoItem, styles.convoItemEditing)}>
        <input
          ref={inputRef}
          className={styles.convoEditInput}
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') handleCancel();
          }}
          onBlur={handleSave}
        />
        <button className={styles.convoActionBtn} onClick={handleSave}>
          <Check style={{ width: 12, height: 12 }} />
        </button>
        <button className={styles.convoActionBtn} onClick={handleCancel}>
          <X style={{ width: 12, height: 12 }} />
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(styles.convoItem, isActive && styles.convoItemActive)}
      onClick={onSelect}
    >
      <MessageSquare style={{ width: 14, height: 14, flexShrink: 0, opacity: 0.5 }} />
      <span className={styles.convoName}>{convo.name}</span>
      <span className={styles.convoTime}>{formatTimeAgo(convo.updatedAt)}</span>
      <div className={styles.convoActions}>
        <button
          className={styles.convoActionBtn}
          onClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
        >
          <Pencil style={{ width: 11, height: 11 }} />
        </button>
        <button
          className={styles.convoActionBtn}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 style={{ width: 11, height: 11 }} />
        </button>
      </div>
    </div>
  );
}

// ── Main page component ────────────────────────────────────────────

export function ReportsPage() {
  const {
    messages,
    loading,
    duration,
    setDuration,
    format,
    setFormat,
    quota,
    conversations,
    activeConversationId,
    submitQuestion,
    startNewConversation,
    loadConversation,
    renameConversation,
    deleteConversation,
  } = useReports();

  const [input, setInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = () => {
    if (!input.trim() || loading) return;
    submitQuestion(input.trim());
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  return (
    <div className={styles.reports}>
      <AppHeader />

      <div className="action-bar">
        <span className="action-bar__status">Reports</span>
        <div className="action-bar__spacer" />
        {quota && (
          <div className="action-bar__right">
            <span style={{ fontSize: 12, color: '#686868' }}>
              Queries: {quota.queriesUsed}/{quota.queriesLimit}
            </span>
          </div>
        )}
      </div>

      <div className={styles.reportsLayout}>
        {/* ── Sidebar: Conversation History ── */}
        <aside className={styles.sidebar}>
          <button className={styles.newChatBtn} onClick={startNewConversation}>
            <Plus style={{ width: 14, height: 14 }} />
            New Chat
          </button>
          <div className={styles.convoList}>
            {conversations.map((c) => (
              <ConversationItem
                key={c.id}
                convo={c}
                isActive={c.id === activeConversationId}
                onSelect={() => loadConversation(c.id)}
                onRename={(name) => renameConversation(c.id, name)}
                onDelete={() => deleteConversation(c.id)}
              />
            ))}
            {conversations.length === 0 && (
              <div className={styles.convoEmpty}>No conversations yet</div>
            )}
          </div>
        </aside>

        {/* ── Main Chat Card ── */}
        <div className={styles.chatCard}>
          {/* Chat area */}
          <div className={styles.chatArea}>
            {messages.length === 0 ? (
              <div className={styles.chatEmpty}>
                <div className={styles.chatEmptyIcon}>
                  <Sparkles className={styles.chatEmptySparkles} />
                </div>
                <div className={styles.chatEmptyTitle}>
                  Hooklab <span className={styles.chatEmptyTitleAi}>AI.</span>
                </div>
                <div className={styles.chatSuggestions}>
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      className={styles.chatSuggestion}
                      onClick={() => {
                        setInput(s);
                        inputRef.current?.focus();
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
            )}
            <div ref={chatEndRef} />
          </div>

          {/* ── Bottom controls + input ── */}
          <div className={styles.chatBottom}>
            {/* Duration + Format inline */}
            <div className={styles.controls}>
              <div className={styles.controlGroup}>
                <span className={styles.controlLabel}>Duration:</span>
                {DURATIONS.map((d) => (
                  <button
                    key={d.value}
                    className={cn(styles.pill, duration === d.value && styles.pillActive)}
                    onClick={() => setDuration(d.value)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <div className={styles.controlGroup}>
                <span className={styles.controlLabel}>Format:</span>
                {FORMATS.map((f) => (
                  <button
                    key={f.value}
                    className={cn(styles.pill, format === f.value && styles.pillActive)}
                    onClick={() => setFormat(f.value)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Input row */}
            <div className={styles.inputArea}>
              <div className={styles.inputWrap}>
                <textarea
                  ref={inputRef}
                  className={styles.inputField}
                  placeholder="Ask about your webhooks... (e.g., 'Show me failed requests this week')"
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  disabled={loading}
                />
              </div>
              <button
                className={styles.sendBtn}
                onClick={handleSubmit}
                disabled={!input.trim() || loading}
              >
                <Send className={styles.sendIcon} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <AppFooter />
    </div>
  );
}
