import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Endpoint } from '@/lib/api';
import {
  getEndpoint,
  updateEndpoint as updateEndpointFn,
} from '@/lib/firestore';

export function useEndpoint(endpointId: string | undefined) {
  const [endpoint, setEndpoint] = useState<Endpoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!endpointId) return;
    try {
      const ep = await getEndpoint(endpointId);
      setEndpoint(ep);
      setError(null);
    } catch {
      setError('Failed to load endpoint');
      toast.error('Failed to load endpoint');
    }
  }, [endpointId]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await refetch();
      setLoading(false);
    };
    load();
  }, [refetch]);

  const updateEndpoint = useCallback(
    async (
      data: Partial<
        Pick<
          Endpoint,
          'name' | 'script' | 'defaultStatusCode' | 'defaultContentType' | 'defaultBody' | 'isActive'
        >
      >
    ): Promise<Endpoint> => {
      if (!endpointId) throw new Error('No endpoint ID');
      const updated = await updateEndpointFn(endpointId, data);
      setEndpoint(updated);
      return updated;
    },
    [endpointId]
  );

  return { endpoint, setEndpoint, loading, error, refetch, updateEndpoint };
}
