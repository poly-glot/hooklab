import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Endpoint } from '@/lib/api';

interface EditFields {
  name: string;
  statusCode: number;
  contentType: string;
  defaultBody: string;
}

export function useEndpointEdit(
  endpoint: Endpoint | null,
  onSave: (fields: Partial<Endpoint>) => Promise<void>
) {
  const [editing, setEditing] = useState(false);
  const [editFields, setEditFields] = useState<EditFields>({
    name: '',
    statusCode: 200,
    contentType: 'application/json',
    defaultBody: '{"ok": true}',
  });
  const [saving, setSaving] = useState(false);

  const setEditField = useCallback(
    <K extends keyof EditFields>(field: K, value: EditFields[K]) => {
      setEditFields((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const startEdit = useCallback(() => {
    if (!endpoint) return;
    setEditFields({
      name: endpoint.name,
      statusCode: endpoint.defaultStatusCode,
      contentType: endpoint.defaultContentType,
      defaultBody: endpoint.defaultBody,
    });
    setEditing(true);
  }, [endpoint]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!endpoint) return;
    try {
      setSaving(true);
      await onSave({
        name: editFields.name.trim() || endpoint.name,
        defaultStatusCode: editFields.statusCode || 200,
        defaultContentType: editFields.contentType || 'application/json',
        defaultBody: editFields.defaultBody,
      });
      setEditing(false);
      toast.success('Endpoint updated');
    } catch {
      toast.error('Failed to update endpoint');
    } finally {
      setSaving(false);
    }
  }, [endpoint, editFields, onSave]);

  return { editing, editFields, setEditField, startEdit, saveEdit, cancelEdit, saving };
}
