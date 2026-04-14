/**
 * AddSectionModal — create or edit a form section.
 * Used in the Form Builder's section list.
 */

import { useState, useEffect, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { FormSectionAdmin } from '@/features/forms/types/form.types';

interface AddSectionModalProps {
  /** If provided, the modal is in edit mode for this section. */
  section?: FormSectionAdmin | null;
  onSave: (data: { title: string; short_title: string; description: string; icon_name: string }) => Promise<void>;
  onClose: () => void;
}

const ICON_SUGGESTIONS = [
  'User', 'Heart', 'Brain', 'Accessibility', 'Utensils',
  'ShieldCheck', 'Activity', 'Pill', 'Upload', 'PenLine',
  'FileText', 'ClipboardList', 'Stethoscope', 'Home',
];

export function AddSectionModal({ section, onSave, onClose }: AddSectionModalProps) {
  const { t } = useTranslation();
  const isEdit = Boolean(section);

  const [title, setTitle]             = useState(section?.title ?? '');
  const [shortTitle, setShortTitle]   = useState(section?.short_title ?? '');
  const [description, setDescription] = useState(section?.description ?? '');
  const [iconName, setIconName]       = useState(section?.icon_name ?? '');
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);

  // Auto-fill short_title from title when creating
  useEffect(() => {
    if (!isEdit && title && !shortTitle) {
      setShortTitle(title.split(' ').slice(0, 2).join(' '));
    }
  }, [title, isEdit, shortTitle]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !shortTitle.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({ title: title.trim(), short_title: shortTitle.trim(), description: description.trim(), icon_name: iconName.trim() });
      onClose();
    } catch {
      setError(t('form_builder.save_error'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-[var(--card)] rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--card-foreground)]">
            {isEdit ? t('form_builder.edit_section') : t('form_builder.add_section')}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--dash-nav-hover-bg)] transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--card-foreground)] mb-1">
              {t('form_builder.section_title')} *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={255}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--ember-orange)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--card-foreground)] mb-1">
              {t('form_builder.section_short_title')} *
              <span className="ml-1 text-xs text-[var(--muted-foreground)]">({t('form_builder.shown_in_sidebar')})</span>
            </label>
            <input
              type="text"
              value={shortTitle}
              onChange={(e) => setShortTitle(e.target.value)}
              required
              maxLength={100}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--ember-orange)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--card-foreground)] mb-1">
              {t('form_builder.section_description')}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={1000}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--ember-orange)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--card-foreground)] mb-1">
              {t('form_builder.section_icon')}
              <span className="ml-1 text-xs text-[var(--muted-foreground)]">({t('form_builder.lucide_icon_name')})</span>
            </label>
            <input
              type="text"
              value={iconName}
              onChange={(e) => setIconName(e.target.value)}
              maxLength={50}
              placeholder="e.g. Heart, User, ShieldCheck"
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--ember-orange)]"
            />
            <div className="flex flex-wrap gap-1 mt-2">
              {ICON_SUGGESTIONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setIconName(icon)}
                  className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                    iconName === icon
                      ? 'bg-[var(--ember-orange)] text-white border-[var(--ember-orange)]'
                      : 'border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--ember-orange)]'
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] text-[var(--card-foreground)] hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim() || !shortTitle.trim()}
              className="px-4 py-2 text-sm rounded-lg bg-[var(--ember-orange)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
