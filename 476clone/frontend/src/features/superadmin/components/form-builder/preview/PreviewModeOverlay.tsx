import { X, Monitor, Tablet, Smartphone } from 'lucide-react';
import { motion } from 'framer-motion';
import type { FormDefinitionDetail, FieldWidth } from '@/features/forms/types/form.types';
import { FieldPreviewWidget } from '../canvas/field-previews/FieldPreviewWidget';

type PreviewMode = 'desktop' | 'tablet' | 'mobile';

interface PreviewModeOverlayProps {
  definition: FormDefinitionDetail;
  mode: PreviewMode;
  onClose: () => void;
}

const DEVICE_CONFIG: Record<PreviewMode, { width: string; label: string; icon: typeof Monitor }> = {
  desktop: { width: '100%',  label: 'Desktop', icon: Monitor },
  tablet:  { width: '768px', label: 'Tablet',  icon: Tablet },
  mobile:  { width: '375px', label: 'Mobile',  icon: Smartphone },
};

function fieldWidthClass(width: FieldWidth, mode: PreviewMode): string {
  if (mode === 'mobile') return 'w-full';
  switch (width) {
    case 'half':  return 'w-full md:w-[calc(50%-6px)]';
    case 'third': return 'w-full md:w-[calc(33.333%-8px)]';
    default:      return 'w-full';
  }
}

export function PreviewModeOverlay({ definition, mode, onClose }: PreviewModeOverlayProps) {
  const config = DEVICE_CONFIG[mode];
  const Icon   = config.icon;

  const activeSections = definition.sections
    .filter((s) => s.is_active)
    .map((s) => ({ ...s, fields: s.fields.filter((f) => f.is_active) }));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-20 bg-[var(--background)] overflow-auto flex flex-col"
    >
      {/* Preview toolbar */}
      <div className="flex-shrink-0 flex items-center gap-3 px-6 py-3 border-b border-[var(--border)] bg-[var(--card)]">
        <Icon size={15} className="text-[var(--ember-orange)]" />
        <span className="text-sm font-medium text-[var(--card-foreground)]">
          Preview — {config.label}
        </span>
        <span className="text-xs text-[var(--muted-foreground)]">
          {activeSections.length} sections · {activeSections.reduce((n, s) => n + s.fields.length, 0)} fields
        </span>
        <div className="flex-1" />
        <span className="text-xs text-[var(--muted-foreground)] bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200">
          Preview — Not submittable
        </span>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[var(--card-foreground)] hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
        >
          <X size={13} /> Exit Preview
        </button>
      </div>

      {/* Preview content */}
      <div className="flex-1 overflow-auto py-6 px-4 flex justify-center">
        <div
          className="bg-white rounded-2xl shadow-xl border border-[var(--border)] overflow-hidden"
          style={{ width: config.width, maxWidth: '100%' }}
        >
          {/* Form header */}
          <div className="px-8 py-6 border-b border-[var(--border)] bg-[var(--ember-orange)]/5">
            <h1 className="text-xl font-bold text-[var(--card-foreground)]" style={{ fontFamily: 'var(--font-headline)' }}>
              {definition.name}
            </h1>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">v{definition.version}</p>
          </div>

          {/* Sections */}
          <div className="px-8 py-6 space-y-8">
            {activeSections.length === 0 && (
              <p className="text-sm text-center text-[var(--muted-foreground)] py-8">
                No active sections to preview
              </p>
            )}
            {activeSections.map((section) => (
              <div key={section.id}>
                <div className="mb-4 pb-3 border-b border-[var(--border)]">
                  <h2 className="text-base font-semibold text-[var(--card-foreground)]" style={{ fontFamily: 'var(--font-headline)' }}>
                    {section.title}
                  </h2>
                  {section.description && (
                    <p className="text-sm text-[var(--muted-foreground)] mt-0.5">{section.description}</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-4">
                  {section.fields.map((field) => {
                    const hasConditional = !!field.conditional_logic;
                    return (
                      <div
                        key={field.id}
                        className={`${fieldWidthClass(field.width, mode)} ${hasConditional ? 'opacity-60 bg-amber-50/50 rounded-lg p-2 border border-dashed border-amber-200' : ''}`}
                      >
                        <FieldPreviewWidget field={field} />
                        {hasConditional && field.conditional_logic && (
                          <p className="text-xs text-amber-600 mt-1">
                            Shown if: {field.conditional_logic.show_if.field_key} = {String(field.conditional_logic.show_if.equals)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                  {section.fields.length === 0 && (
                    <p className="text-xs text-[var(--muted-foreground)] py-2">No active fields in this section</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Preview footer */}
          <div className="px-8 py-4 border-t border-[var(--border)] flex justify-end">
            <div className="px-6 py-2 rounded-lg bg-gray-200 text-gray-500 text-sm cursor-not-allowed">
              Submit Application (Preview Only)
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
