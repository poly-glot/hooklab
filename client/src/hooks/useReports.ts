import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  api,
  type ReportDuration,
  type ReportFormat,
  type ReportQueryResponse,
  type QuotaStatus,
} from '@/lib/api';
import {
  createConversation,
  getConversations,
  getMessages,
  addMessage,
  renameConversation,
  deleteConversation,
  type Conversation,
  type PersistedMessage,
} from '@/lib/chat-store';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  report?: ReportQueryResponse;
  isLoading?: boolean;
  error?: string;
}

function persistedToChatMessage(pm: PersistedMessage): ChatMessage {
  const msg: ChatMessage = {
    id: pm.id,
    role: pm.role,
    content: pm.content,
    timestamp: pm.timestamp,
    error: pm.error,
  };
  if (pm.reportData) {
    try {
      msg.report = JSON.parse(pm.reportData);
    } catch {}
  }
  return msg;
}

export function useReports() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [duration, setDuration] = useState<ReportDuration>('7d');
  const [format, setFormat] = useState<ReportFormat>('table');
  const [quota, setQuota] = useState<QuotaStatus | null>(null);

  // Conversation state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [conversationsLoading, setConversationsLoading] = useState(true);

  // Fetch quota + conversations on mount
  useEffect(() => {
    api.getReportQuota().then(setQuota).catch(() => {});
    loadConversations();
  }, []);

  const loadConversations = useCallback(async () => {
    setConversationsLoading(true);
    try {
      const convos = await getConversations();
      setConversations(convos);
    } catch {
      // May fail for guests without Firestore rules
    } finally {
      setConversationsLoading(false);
    }
  }, []);

  const loadConversation = useCallback(async (conversationId: string) => {
    setActiveConversationId(conversationId);
    try {
      const msgs = await getMessages(conversationId);
      setMessages(msgs.map(persistedToChatMessage));
    } catch {
      setMessages([]);
    }
  }, []);

  const startNewConversation = useCallback(() => {
    setActiveConversationId(null);
    setMessages([]);
  }, []);

  const handleRenameConversation = useCallback(
    async (conversationId: string, newName: string) => {
      await renameConversation(conversationId, newName);
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, name: newName } : c))
      );
    },
    []
  );

  const handleDeleteConversation = useCallback(
    async (conversationId: string) => {
      await deleteConversation(conversationId);
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      if (activeConversationId === conversationId) {
        setActiveConversationId(null);
        setMessages([]);
      }
    },
    [activeConversationId]
  );

  const submitQuestion = useCallback(
    async (question: string, endpointIds?: string[]) => {
      if (!question.trim() || loading) return;

      // Create conversation if none active
      let convId = activeConversationId;
      if (!convId) {
        try {
          const conv = await createConversation();
          convId = conv.id;
          setActiveConversationId(convId);
          setConversations((prev) => [conv, ...prev]);
        } catch {
          // Firestore may not be available — continue without persistence
          convId = null;
        }
      }

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: question,
        timestamp: new Date().toISOString(),
      };

      const loadingMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        isLoading: true,
      };

      setMessages((prev) => [...prev, userMsg, loadingMsg]);
      setLoading(true);

      // Persist user message
      if (convId) {
        addMessage(convId, {
          role: 'user',
          content: question,
          timestamp: new Date().toISOString(),
        }).catch(() => {});
      }

      try {
        const result = await api.queryReport({
          question,
          duration,
          format,
          endpointIds,
        });

        const assistantMsg: ChatMessage = {
          id: loadingMsg.id,
          role: 'assistant',
          content: result.meta.explanation,
          timestamp: new Date().toISOString(),
          report: result,
        };

        setMessages((prev) =>
          prev.map((m) => (m.id === loadingMsg.id ? assistantMsg : m))
        );

        setQuota(result.quota);

        // Persist assistant message
        if (convId) {
          addMessage(convId, {
            role: 'assistant',
            content: result.meta.explanation,
            timestamp: new Date().toISOString(),
            reportData: JSON.stringify(result),
          }).catch(() => {});
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to run query';

        const errorMsg: ChatMessage = {
          id: loadingMsg.id,
          role: 'assistant',
          content: errorMessage,
          timestamp: new Date().toISOString(),
          error: errorMessage,
        };

        setMessages((prev) =>
          prev.map((m) => (m.id === loadingMsg.id ? errorMsg : m))
        );

        // Persist error message
        if (convId) {
          addMessage(convId, {
            role: 'assistant',
            content: errorMessage,
            timestamp: new Date().toISOString(),
            error: errorMessage,
          }).catch(() => {});
        }

        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [duration, format, loading, activeConversationId]
  );

  const clearChat = useCallback(() => {
    setActiveConversationId(null);
    setMessages([]);
  }, []);

  return {
    messages,
    loading,
    duration,
    setDuration,
    format,
    setFormat,
    quota,
    conversations,
    conversationsLoading,
    activeConversationId,
    submitQuestion,
    startNewConversation,
    loadConversation,
    renameConversation: handleRenameConversation,
    deleteConversation: handleDeleteConversation,
    clearChat,
  };
}
