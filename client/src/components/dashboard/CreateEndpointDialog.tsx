import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import styles from './CreateEndpointDialog.module.css';

interface CreateEndpointDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => Promise<unknown>;
}

export function CreateEndpointDialog({ open, onOpenChange, onSubmit }: CreateEndpointDialogProps) {
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    } else {
      // Reset state when dialog closes
      setName('');
      setCreating(false);
    }
  }, [open]);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Please enter an endpoint name');
      return;
    }
    try {
      setCreating(true);
      await onSubmit(name.trim());
      // Close dialog (cleanup happens in useEffect)
      onOpenChange(false);
      toast.success('Endpoint created successfully');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to create endpoint';
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Endpoint</DialogTitle>
          <DialogDescription>
            Give your webhook endpoint a descriptive name.
          </DialogDescription>
        </DialogHeader>
        <div className={styles.dialogBody}>
          <div className={styles.dialogField}>
            <Label htmlFor="endpoint-name">Endpoint Name</Label>
            <Input
              id="endpoint-name"
              ref={inputRef}
              placeholder="e.g., Payment Notifications"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            disabled={creating}
            className="btn btn--outline"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="btn btn--primary"
          >
            {creating ? 'Creating...' : 'Create Endpoint'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
