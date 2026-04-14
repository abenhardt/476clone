import { useState } from 'react';
import { X, Search } from 'lucide-react';
import { FIELD_LIBRARY, GROUP_LABELS } from '../fieldLibraryConfig';
import type { FieldType } from '@/features/forms/types/form.types';

interface FieldTypePickerModalProps {
  onSelect: (type: FieldType) => void;
  onClose: () => void;
}

export function FieldTypePickerModal({ onSelect, onClose }: FieldTypePickerModalProps) {
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? FIELD_LIBRARY.filter((f) =>
        f.label.toLowerCase().includes(search.toLowerCase()) ||
        f.type.toLowerCase().includes(search.toLowerCase())
      )
    : FIELD_LIBRARY;

  // Group filtered items by their group key
  const groups = Object.keys(GROUP_LABELS).reduce<Record<string, typeof FIELD_LIBRARY>>((acc, key) => {
    const items = filtered.filter((f) => f.group === key);
    if (items.length > 0) acc[key] = items;
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-[var(--card)] rounded-xl shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-base font-semibold text-[var(--card-foreground)]">Add Field</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded text-[var(--muted-foreground)] hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-[var(--border)]">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search field types…"
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              className="w-full pl-8 pr-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-1 focus:ring-[var(--ember-orange)]"
            />
          </div>
        </div>

        {/* Field groups */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {Object.keys(groups).length === 0 && (
            <p className="text-sm text-center text-[var(--muted-foreground)] py-6">
              No field types match "{search}"
            </p>
          )}

          {Object.entries(groups).map(([groupKey, items]) => (
            <div key={groupKey}>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] mb-2">
                {GROUP_LABELS[groupKey]}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => { onSelect(item.type); onClose(); }}
                      className="flex flex-col items-center gap-2 p-3 rounded-lg border border-[var(--border)] bg-[var(--background)] hover:border-[var(--ember-orange)] hover:bg-[var(--ember-orange)]/5 hover:text-[var(--ember-orange)] transition-all text-[var(--card-foreground)] group"
                    >
                      <Icon size={18} className="text-[var(--muted-foreground)] group-hover:text-[var(--ember-orange)] transition-colors" />
                      <span className="text-xs font-medium text-center leading-tight">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
