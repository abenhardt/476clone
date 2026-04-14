import { X, Copy } from 'lucide-react';
import { motion } from 'framer-motion';
import { StatusBadge } from '../shared/StatusBadge';
import type { FormDefinitionListItem } from '@/features/forms/types/form.types';

interface VersionHistoryDrawerProps {
  definitions: FormDefinitionListItem[];
  selectedId: number | null;
  actionLoading: string | null;
  onClose: () => void;
  onSelect: (id: number) => void;
  onDuplicate: (id: number) => Promise<void>;
}

export function VersionHistoryDrawer({
  definitions, selectedId, actionLoading, onClose, onSelect, onDuplicate,
}: VersionHistoryDrawerProps) {
  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close version history"
        className="fixed inset-0 z-30 bg-black/20 cursor-default"
        onClick={onClose}
      />

      {/* Drawer */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 bottom-0 z-40 w-80 bg-[var(--card)] border-l border-[var(--border)] shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--card-foreground)]">Version History</p>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded text-[var(--muted-foreground)] hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Version list */}
        <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)]">
          {definitions.length === 0 && (
            <p className="px-5 py-8 text-sm text-center text-[var(--muted-foreground)]">No versions found</p>
          )}
          {definitions.map((def) => (
            <div
              key={def.id}
              className={`px-5 py-4 ${selectedId === def.id ? 'bg-[var(--ember-orange)]/5' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-[var(--card-foreground)]">v{def.version}</span>
                    <StatusBadge status={def.status} />
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)] truncate">{def.name}</p>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">
                    {def.section_count} sections
                    {def.created_by && ` · by ${def.created_by}`}
                  </p>
                  {def.published_at && (
                    <p className="text-xs text-[var(--muted-foreground)]">
                      Published {new Date(def.published_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => onSelect(def.id)}
                  className={`flex-1 py-1 text-xs rounded-lg border transition-colors ${
                    selectedId === def.id
                      ? 'border-[var(--ember-orange)] text-[var(--ember-orange)] bg-[var(--ember-orange)]/5'
                      : 'border-[var(--border)] text-[var(--card-foreground)] hover:bg-[var(--dash-nav-hover-bg)]'
                  }`}
                >
                  {selectedId === def.id ? 'Loaded' : 'Load'}
                </button>
                <button
                  type="button"
                  onClick={() => onDuplicate(def.id)}
                  disabled={actionLoading === `dup-${def.id}`}
                  title="Duplicate as new draft"
                  className="px-2 py-1 text-xs rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--ember-orange)] hover:bg-[var(--ember-orange)]/10 transition-colors disabled:opacity-40"
                >
                  <Copy size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </>
  );
}
