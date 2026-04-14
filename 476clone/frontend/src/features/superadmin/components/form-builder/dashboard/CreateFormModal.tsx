import { useState, type FormEvent } from 'react';
import { X, FileText } from 'lucide-react';

interface CreateFormModalProps {
  onSave: (name: string, description: string | null) => Promise<void>;
  onClose: () => void;
}

export function CreateFormModal({ onSave, onClose }: CreateFormModalProps) {
  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [nameError, setNameError]     = useState('');
  const [saving, setSaving]           = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setNameError('Name is required'); return; }
    setSaving(true);
    try {
      await onSave(name.trim(), description.trim() || null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-[var(--card)] rounded-xl shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[var(--ember-orange)]/10">
              <FileText size={16} className="text-[var(--ember-orange)]" />
            </div>
            <h2 className="text-base font-semibold text-[var(--card-foreground)]">Create New Form</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded text-[var(--muted-foreground)] hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="cfm-name" className="text-sm font-medium text-[var(--card-foreground)]">
              Form Name <span className="text-red-500">*</span>
            </label>
            <input
              id="cfm-name"
              value={name}
              onChange={(e) => { setName(e.target.value); setNameError(''); }}
              placeholder="e.g. Camp Application Form"
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              className={`w-full px-3 py-2 text-sm border rounded-lg bg-[var(--background)] focus:outline-none focus:ring-1 ${
                nameError
                  ? 'border-red-400 focus:ring-red-400'
                  : 'border-[var(--border)] focus:ring-[var(--ember-orange)]'
              }`}
            />
            {nameError && <p className="text-xs text-red-600">{nameError}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="cfm-description" className="text-sm font-medium text-[var(--card-foreground)]">
              Description <span className="text-[var(--muted-foreground)] font-normal">(optional)</span>
            </label>
            <textarea
              id="cfm-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this form used for?"
              rows={3}
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-1 focus:ring-[var(--ember-orange)] resize-none"
            />
          </div>

          <p className="text-xs text-[var(--muted-foreground)]">
            The new form will be created as a draft. You can add sections and fields before publishing.
          </p>

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] text-[var(--card-foreground)] hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-medium rounded-lg bg-[var(--ember-orange)] text-white hover:opacity-90 disabled:opacity-60 transition-opacity"
            >
              {saving ? 'Creating…' : 'Create Form'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
