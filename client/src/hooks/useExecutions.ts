import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { RequestLog } from '@/lib/api';
import {
  clearExecutions,
  deleteExecution,
  onExecutionsSnapshot,
} from '@/lib/firestore';

const ITEMS_PER_PAGE = 20;

export function useExecutions(endpointId: string | undefined, autoRefresh: boolean) {
  const [requests, setRequests] = useState<RequestLog[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<RequestLog | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  const selectedRequestRef = useRef<RequestLog | null>(null);

  // Real-time listener for executions
  useEffect(() => {
    if (!endpointId || !autoRefresh) return;
    const unsubscribe = onExecutionsSnapshot(endpointId, (executions) => {
      setRequests(executions);
      if (!selectedRequestRef.current && executions.length > 0) {
        setSelectedRequest(executions[0]);
        selectedRequestRef.current = executions[0];
      }
    });
    return () => unsubscribe();
  }, [endpointId, autoRefresh]);

  // Keep ref in sync
  useEffect(() => {
    selectedRequestRef.current = selectedRequest;
  }, [selectedRequest]);

  const clearAll = useCallback(async () => {
    if (!endpointId) return;
    try {
      await clearExecutions(endpointId);
      setRequests([]);
      setSelectedRequest(null);
      selectedRequestRef.current = null;
      setCurrentPage(0);
      toast.success('All requests cleared');
    } catch {
      toast.error('Failed to clear requests');
    }
  }, [endpointId]);

  const deleteOne = useCallback(
    async (requestId: string) => {
      if (!endpointId) return;
      try {
        await deleteExecution(endpointId, requestId);
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
        if (selectedRequestRef.current?.id === requestId) {
          setSelectedRequest(null);
          selectedRequestRef.current = null;
        }
        toast.success('Request deleted');
      } catch {
        toast.error('Failed to delete request');
      }
    },
    [endpointId]
  );

  const totalPages = Math.max(1, Math.ceil(requests.length / ITEMS_PER_PAGE));
  const paginatedRequests = requests.slice(
    currentPage * ITEMS_PER_PAGE,
    (currentPage + 1) * ITEMS_PER_PAGE
  );

  return {
    requests,
    selectedRequest,
    setSelectedRequest,
    clearAll,
    deleteOne,
    paginatedRequests,
    currentPage,
    setCurrentPage,
    totalPages,
  };
}
