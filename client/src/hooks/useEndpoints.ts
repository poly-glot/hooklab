import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Endpoint } from '@/lib/api';
import {
  getEndpoints,
  createEndpoint as createEndpointFn,
  deleteEndpoint as deleteEndpointFn,
  updateEndpoint as updateEndpointFn,
} from '@/lib/firestore';
import { getWebhookUrl } from '@/lib/url';

type FilterType = 'all' | 'active' | 'closed';

function getEndpointStatus(ep: Endpoint): 'active' | 'closed' {
  return ep.isActive !== false ? 'active' : 'closed';
}

export function useEndpoints(userId: string | undefined) {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchEndpoints = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const eps = await getEndpoints(userId);
      setEndpoints(eps);
    } catch {
      toast.error('Failed to load endpoints');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchEndpoints();
  }, [fetchEndpoints]);

  const createEndpoint = useCallback(
    async (name: string) => {
      if (!userId) throw new Error('No user');
      const endpoint = await createEndpointFn(userId, name);
      setEndpoints((prev) => [endpoint, ...prev]);
      return endpoint;
    },
    [userId]
  );

  const deleteEndpoint = useCallback(async (endpointId: string) => {
    await deleteEndpointFn(endpointId, userId);
    setEndpoints((prev) => prev.filter((e) => e.id !== endpointId));
  }, [userId]);

  const toggleActive = useCallback(
    async (endpointId: string) => {
      const ep = endpoints.find((e) => e.id === endpointId);
      if (!ep) return;
      const updated = await updateEndpointFn(endpointId, { isActive: ep.isActive === false });
      setEndpoints((prev) => prev.map((e) => (e.id === endpointId ? updated : e)));
      return updated;
    },
    [endpoints]
  );

  const filteredEndpoints = endpoints.filter((ep) => {
    const status = getEndpointStatus(ep);
    const matchesFilter = filter === 'all' || status === filter;

    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      searchQuery === '' ||
      ep.name.toLowerCase().includes(searchLower) ||
      getWebhookUrl(ep.id).toLowerCase().includes(searchLower);

    return matchesFilter && matchesSearch;
  });

  const counts = {
    all: endpoints.length,
    active: endpoints.filter((ep) => getEndpointStatus(ep) === 'active').length,
    closed: endpoints.filter((ep) => getEndpointStatus(ep) === 'closed').length,
  };

  return {
    endpoints,
    loading,
    filteredEndpoints,
    counts,
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    createEndpoint,
    deleteEndpoint,
    toggleActive,
  };
}
