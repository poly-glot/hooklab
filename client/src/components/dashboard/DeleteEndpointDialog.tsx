import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface DeleteEndpointDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  endpointName: string;
  onConfirm: () => Promise<void>;
}

export function DeleteEndpointDialog({
  open,
  onOpenChange,
  endpointName: _endpointName,
  onConfirm,
}: DeleteEndpointDialogProps) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await onConfirm();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Endpoint</DialogTitle>
          <DialogDescription>
            This will permanently delete this endpoint and all associated webhook
            requests. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            disabled={deleting}
            className="btn btn--outline"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="btn btn--danger"
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
