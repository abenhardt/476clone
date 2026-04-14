import { useState, useEffect, type FormEvent } from 'react';
import { Check, X } from 'lucide-react';
import type { FormSectionAdmin, CreateSectionPayload } from '@/features/forms/types/form.types';

const ICON_SUGGESTIONS = [
  'User', 'Heart', 'Brain', 'Accessibility', 'FileText',
  'Users', 'Shield', 'Activity', 'BookOpen', 'Camera', 'Clipboard', 'Star',
];

interface SectionInlineEditorProps {
  section?: FormSectionAdmin | null;
  onSave: (data: CreateSectionPayload) => Promise<void>;
  onCancel: () => void;
}

export function SectionInlineEditor({ section, onSave, onCancel }: SectionInlineEditorProps) {
  const isEdit = !!section;
  const [title, setTitle]           = useState(section?.title ?? '');
  const [shortTitle, setShortTitle] = useState(section?.short_title ?? '');
  const [description, setDescription] = useState(section?.description ?? '');
  const [iconName, setIconName]     = useState(section?.icon_name ?? '');
  const [shortTitleTouched, setShortTitleTouched] = useState(isEdit);
  const [saving, setSaving]         = useState(false);
  const [titleError, setTitleError] = useState('');

  // Auto-fill short_title from first 2 words of title (create mode only)
  useEffect(() => {
    if (!shortTitleTouched && !isEdit) {
      const words = title.trim().split(/\s+/).slice(0, 2).join(' ');
      setShortTitle(words);
    }
  }, [title, shortTitleTouched, isEdit]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setTitleError('Title is required'); return; }
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        short_title: shortTitle.trim() || title.trim().split(/\s+/).slice(0, 2).join(' '),
        description: description.trim() || null,
        icon_name: iconName.trim() || null,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="px-3 py-3 space-y-3 border-t border-[var(--border)] bg-[var(--background)]">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
        {isEdit ? 'Edit Section' : 'New Section'}
      </p>

      <div className="space-y-1">
        <label htmlFor="sie-title" className="text-xs font-medium text-[var(--muted-foreground)]">Title *</label>
        <input
          id="sie-title"
          value={title}
          onChange={(e) => { setTitle(e.target.value); setTitleError(''); }}
          placeholder="e.g. Camper Information"
          className={`w-full px-2 py-1.5 text-sm border rounded-lg bg-[var(--background)] focus:outline-none focus:ring-1 focus:ring-[var(--ember-orange)] ${
            titleError ? 'border-red-400' : 'border-[var(--border)]'
          }`}
        />
        {titleError && <p className="text-xs text-red-600">{titleError}</p>}
      </div>

      <div className="space-y-1">
        <label htmlFor="sie-short-title" className="text-xs font-medium text-[var(--muted-foreground)]">Short Title</label>
        <input
          id="sie-short-title"
          value={shortTitle}
          onChange={(e) => { setShortTitle(e.target.value); setShortTitleTouched(true); }}
          placeholder="Sidebar label"
          className="w-full px-2 py-1.5 text-sm border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-1 focus:ring-[var(--ember-orange)]"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="sie-description" className="text-xs font-medium text-[var(--muted-foreground)]">Description</label>
        <textarea
          id="sie-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
          rows={2}
          className="w-full px-2 py-1.5 text-sm border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-1 focus:ring-[var(--ember-orange)] resize-none"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="sie-icon" className="text-xs font-medium text-[var(--muted-foreground)]">Icon</label>
        <input
          id="sie-icon"
          value={iconName}
          onChange={(e) => setIconName(e.target.value)}
          placeholder="Lucide icon name"
          className="w-full px-2 py-1.5 text-sm border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-1 focus:ring-[var(--ember-orange)]"
        />
        <div className="flex flex-wrap gap-1 mt-1">
          {ICON_SUGGESTIONS.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setIconName(name)}
              className={`px-1.5 py-0.5 text-xs rounded border transition-colors ${
                iconName === name
                  ? 'border-[var(--ember-orange)] bg-[var(--ember-orange)]/10 text-[var(--ember-orange)]'
                  : 'border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--ember-orange)]/50'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium rounded-lg bg-[var(--ember-orange)] text-white hover:opacity-90 disabled:opacity-60 transition-opacity"
        >
          <Check size={12} /> {saving ? 'Saving…' : isEdit ? 'Save' : 'Add Section'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
        >
          <X size={12} />
        </button>
      </div>
    </form>
  );
}
