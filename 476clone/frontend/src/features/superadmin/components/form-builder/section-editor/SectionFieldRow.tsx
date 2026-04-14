import { GripVertical, Eye, EyeOff, Trash2, Asterisk } from 'lucide-react';
import type { DraggableProvided } from '@hello-pangea/dnd';
import type { FormFieldAdmin } from '@/features/forms/types/form.types';
import { FIELD_LIBRARY } from '../fieldLibraryConfig';

interface SectionFieldRowProps {
  field: FormFieldAdmin;
  isSelected: boolean;
  isEditable: boolean;
  provided: DraggableProvided;
  isDragging: boolean;
  onSelect: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}

const FIELD_TYPE_COLORS: Record<string, string> = {
  input:          'bg-blue-50 text-blue-700 border-blue-200',
  choice:         'bg-purple-50 text-purple-700 border-purple-200',
  upload_special: 'bg-amber-50 text-amber-700 border-amber-200',
  layout:         'bg-gray-50 text-gray-600 border-gray-200',
};

export function SectionFieldRow({
  field, isSelected, isEditable, provided, isDragging,
  onSelect, onToggleActive, onDelete,
}: SectionFieldRowProps) {
  const config = FIELD_LIBRARY.find((f) => f.type === field.field_type);
  const Icon = config?.icon;
  const colorClass = FIELD_TYPE_COLORS[config?.group ?? 'input'];

  const widthLabel: Record<string, string> = {
    full: 'Full',
    half: '1/2',
    third: '1/3',
  };

  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(); }}
      className={`group flex items-center gap-3 px-4 py-3.5 rounded-xl border cursor-pointer transition-all ${
        isSelected
          ? 'bg-[var(--ember-orange)]/5 border-[var(--ember-orange)]/40 shadow-sm'
          : isDragging
            ? 'bg-[var(--card)] border-[var(--ember-orange)]/30 shadow-lg'
            : 'bg-[var(--card)] border-[var(--border)] hover:border-[var(--ember-orange)]/30 hover:shadow-sm'
      } ${!field.is_active ? 'opacity-55' : ''}`}
    >
      {/* Drag handle */}
      {isEditable ? (
        <div
          {...provided.dragHandleProps}
          role="button"
          tabIndex={0}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          aria-label="Drag to reorder"
          className="cursor-grab active:cursor-grabbing text-[var(--muted-foreground)] flex-shrink-0 opacity-30 group-hover:opacity-80 transition-opacity"
        >
          <GripVertical size={15} />
        </div>
      ) : (
        <div className="flex-shrink-0 w-4" />
      )}

      {/* Field type badge */}
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border flex-shrink-0 ${colorClass}`}>
        {Icon && <Icon size={10} />}
        {field.field_type}
      </span>

      {/* Field label */}
      <span className="flex-1 text-sm font-medium text-[var(--card-foreground)] truncate">
        {field.label}
      </span>

      {/* Indicators */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {field.is_required && (
          <span title="Required">
            <Asterisk size={11} className="text-red-500" />
          </span>
        )}
        {field.width !== 'full' && (
          <span className="text-xs text-[var(--muted-foreground)] font-mono bg-[var(--background)] border border-[var(--border)] px-1.5 py-0.5 rounded">
            {widthLabel[field.width]}
          </span>
        )}
        {!field.is_active && (
          <span className="text-xs text-[var(--muted-foreground)]">Inactive</span>
        )}
      </div>

      {/* Action buttons — visible on hover */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        {isEditable && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleActive(); }}
            title={field.is_active ? 'Deactivate field' : 'Activate field'}
            className="p-1.5 rounded text-[var(--muted-foreground)] hover:text-[var(--card-foreground)] hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
          >
            {field.is_active ? <Eye size={13} /> : <EyeOff size={13} />}
          </button>
        )}
        {isEditable && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="Delete field"
            className="p-1.5 rounded text-[var(--muted-foreground)] hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
}
