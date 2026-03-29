import styles from './EndpointEditPanel.module.css';

interface EditFields {
  name: string;
  statusCode: number;
  contentType: string;
  defaultBody: string;
}

interface EndpointEditPanelProps {
  editFields: EditFields;
  setEditField: <K extends keyof EditFields>(field: K, value: EditFields[K]) => void;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}

export function EndpointEditPanel({
  editFields,
  setEditField,
  saving,
  onSave,
  onCancel,
}: EndpointEditPanelProps) {
  return (
    <div className={styles.editPanel}>
      <div className={styles.editPanelInner}>
        <div className={styles.editPanelField}>
          <label htmlFor="edit-name" className={styles.editPanelLabel}>Name</label>
          <input
            id="edit-name"
            type="text"
            value={editFields.name}
            onChange={(e) => setEditField('name', e.target.value)}
            className={styles.editPanelInput}
          />
        </div>
        <div className={styles.editPanelRow}>
          <div className={styles.editPanelField}>
            <label htmlFor="edit-status-code" className={styles.editPanelLabel}>Status Code</label>
            <input
              id="edit-status-code"
              type="number"
              value={editFields.statusCode}
              onChange={(e) => setEditField('statusCode', parseInt(e.target.value, 10) || 0)}
              className={styles.editPanelInput}
            />
          </div>
          <div className={styles.editPanelField}>
            <label htmlFor="edit-content-type" className={styles.editPanelLabel}>Content Type</label>
            <input
              id="edit-content-type"
              type="text"
              value={editFields.contentType}
              onChange={(e) => setEditField('contentType', e.target.value)}
              className={styles.editPanelInput}
            />
          </div>
        </div>
        <div className={styles.editPanelField}>
          <label htmlFor="edit-default-body" className={styles.editPanelLabel}>Default Body</label>
          <textarea
            id="edit-default-body"
            value={editFields.defaultBody}
            onChange={(e) => setEditField('defaultBody', e.target.value)}
            rows={3}
            className={styles.editPanelTextarea}
          />
        </div>
        <div className={styles.editPanelActions}>
          <button
            onClick={onCancel}
            disabled={saving}
            className="btn btn--outline"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="btn btn--primary"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
