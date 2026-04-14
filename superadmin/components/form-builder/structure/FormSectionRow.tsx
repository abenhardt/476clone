import { GripVertical, ChevronRight, Pencil, Eye, EyeOff, Trash2 } from 'lucide-react';
import type { DraggableProvided } from '@hello-pangea/dnd';
import type { FormSectionAdmin } from '@/features/forms/types/form.types';

interface FormSectionRowProps {
  section: FormSectionAdmin;
  index: number;
  isEditable: boolean;
  provided: DraggableProvided;
  isDragging: boolean;
  onEnter: () => void;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}

export function FormSectionRow({
  section, index, isEditable, provided, isDragging,
  onEnter, onEdit, onToggleActive, onDelete,
}: FormSectionRowProps) {
  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      className={`group flex items-center gap-3 px-4 py-4 bg-[var(--card)] border border-[var(--border)] rounded-xl transition-all ${
        isDragging ? 'shadow-lg border-[var(--ember-orange)]/30' : 'hover:shadow-sm'
      } ${!section.is_active ? 'opacity-60' : ''}`}
    >
      {/* Drag handle */}
      {isEditable ? (
        <div
          {...provided.dragHandleProps}
          className="cursor-grab active:cursor-grabbing text-[var(--muted-foreground)] hover:text-[var(--card-foreground)] flex-shrink-0 opacity-40 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical size={16} />
        </div>
      ) : (
        <div className="flex-shrink-0 w-4" />
      )}

      {/* Sort order badge */}
      <span className="w-6 h-6 rounded-full bg-[var(--ember-orange)]/10 text-[var(--ember-orange)] text-xs font-semibold flex items-center justify-center flex-shrink-0">
        {index + 1}
      </span>

      {/* Section info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--card-foreground)] truncate">
            {section.title}
          </span>
          {!section.is_active && (
            <span className="text-xs text-[var(--muted-foreground)] bg-[var(--background)] border border-[var(--border)] px-1.5 py-0.5 rounded flex-shrink-0">
              Inactive
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs text-[var(--muted-foreground)]">
            {section.field_count} {section.field_count === 1 ? 'field' : 'fields'}
          </span>
          {section.description && (
            <span className="text-xs text-[var(--muted-foreground)] truncate max-w-[280px]">
              {section.description}
            </span>
          )}
        </div>
      </div>

      {/* Action buttons — visible on hover */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        {isEditable && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            title="Edit section"
            className="p-1.5 rounded text-[var(--muted-foreground)] hover:text-[var(--card-foreground)] hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
          >
            <Pencil size={13} />
          </button>
        )}
        {isEditable && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleActive(); }}
            title={section.is_active ? 'Deactivate section' : 'Activate section'}
            className="p-1.5 rounded text-[var(--muted-foreground)] hover:text-[var(--card-foreground)] hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
          >
            {section.is_active ? <Eye size={13} /> : <EyeOff size={13} />}
          </button>
        )}
        {isEditable && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="Delete section"
            className="p-1.5 rounded text-[var(--muted-foreground)] hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* Enter arrow — always visible */}
      <button
        type="button"
        onClick={onEnter}
        title="Edit fields in this section"
        className="p-1.5 rounded text-[var(--muted-foreground)] hover:text-[var(--ember-orange)] hover:bg-[var(--ember-orange)]/10 transition-colors flex-shrink-0"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
