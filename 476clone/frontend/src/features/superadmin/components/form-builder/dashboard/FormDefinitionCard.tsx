import { Copy, Eye, Pencil, Archive, Layers } from 'lucide-react';
import type { FormDefinitionListItem } from '@/features/forms/types/form.types';
import { StatusBadge } from '../shared/StatusBadge';

interface FormDefinitionCardProps {
  def: FormDefinitionListItem;
  actionLoading: string | null;
  onEdit: () => void;
  onPreview: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
}

export function FormDefinitionCard({
  def, actionLoading, onEdit, onPreview, onDuplicate, onArchive,
}: FormDefinitionCardProps) {
  const isDuplicating = actionLoading === `dup-${def.id}`;
  const isPreviewing  = actionLoading === `preview-${def.id}`;

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 flex flex-col gap-4 hover:shadow-md transition-shadow">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-[var(--ember-orange)]/10 flex-shrink-0">
            <Layers size={18} className="text-[var(--ember-orange)]" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[var(--card-foreground)] truncate">
              {def.name}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-[var(--muted-foreground)]">v{def.version}</span>
              <StatusBadge status={def.status} />
            </div>
          </div>
        </div>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-4 text-xs text-[var(--muted-foreground)]">
        <span>{def.section_count} {def.section_count === 1 ? 'section' : 'sections'}</span>
        {def.created_by && <span>by {def.created_by}</span>}
        {def.published_at ? (
          <span>Published {new Date(def.published_at).toLocaleDateString()}</span>
        ) : (
          <span>Created {new Date(def.created_at).toLocaleDateString()}</span>
        )}
      </div>

      {/* Description */}
      {def.description && (
        <p className="text-xs text-[var(--muted-foreground)] line-clamp-2">{def.description}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-[var(--border)]">
        <button
          type="button"
          onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg bg-[var(--ember-orange)] text-white hover:opacity-90 transition-opacity"
        >
          <Pencil size={12} /> Edit
        </button>

        <button
          type="button"
          onClick={onPreview}
          disabled={isPreviewing}
          title="Preview form"
          className="px-2.5 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--card-foreground)] hover:bg-[var(--dash-nav-hover-bg)] transition-colors disabled:opacity-40"
        >
          <Eye size={13} />
        </button>

        <button
          type="button"
          onClick={onDuplicate}
          disabled={isDuplicating}
          title="Duplicate as new draft"
          className="px-2.5 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--card-foreground)] hover:bg-[var(--dash-nav-hover-bg)] transition-colors disabled:opacity-40"
        >
          {isDuplicating ? '…' : <Copy size={13} />}
        </button>

        {def.status === 'draft' && (
          <button
            type="button"
            onClick={onArchive}
            title="Delete this draft"
            className="px-2.5 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors"
          >
            <Archive size={13} />
          </button>
        )}
      </div>
    </div>
  );
}
