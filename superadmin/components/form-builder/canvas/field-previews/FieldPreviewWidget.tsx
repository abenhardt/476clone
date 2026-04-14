/**
 * FieldPreviewWidget — dispatches to the correct field preview component based on type.
 * Renders a visual mock of what the field looks like to applicants.
 */

import type { FormFieldAdmin } from '@/features/forms/types/form.types';
import { Upload, PenLine, Minus } from 'lucide-react';

interface PreviewProps {
  field: FormFieldAdmin;
}

function Label({ field }: PreviewProps) {
  return (
    <div className="flex items-center gap-1 mb-1.5">
      <span className="text-sm font-medium text-[var(--card-foreground)]">{field.label}</span>
      {field.is_required && <span className="text-red-500 text-xs">*</span>}
    </div>
  );
}

function HelpText({ field }: PreviewProps) {
  if (!field.help_text) return null;
  return <p className="text-xs text-[var(--muted-foreground)] mt-1">{field.help_text}</p>;
}

function TextPreview({ field }: PreviewProps) {
  return (
    <div>
      <Label field={field} />
      <div className="h-8 rounded border border-[var(--border)] bg-[var(--background)] px-3 flex items-center">
        <span className="text-xs text-[var(--muted-foreground)]">{field.placeholder || 'Enter text…'}</span>
      </div>
      <HelpText field={field} />
    </div>
  );
}

function TextareaPreview({ field }: PreviewProps) {
  return (
    <div>
      <Label field={field} />
      <div className="h-16 rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 flex items-start">
        <span className="text-xs text-[var(--muted-foreground)]">{field.placeholder || 'Enter text…'}</span>
      </div>
      <HelpText field={field} />
    </div>
  );
}

function NumberPreview({ field }: PreviewProps) {
  return (
    <div>
      <Label field={field} />
      <div className="h-8 rounded border border-[var(--border)] bg-[var(--background)] px-3 flex items-center">
        <span className="text-xs text-[var(--muted-foreground)]">{field.placeholder || '0'}</span>
      </div>
      <HelpText field={field} />
    </div>
  );
}

function DatePreview({ field }: PreviewProps) {
  return (
    <div>
      <Label field={field} />
      <div className="h-8 rounded border border-[var(--border)] bg-[var(--background)] px-3 flex items-center justify-between">
        <span className="text-xs text-[var(--muted-foreground)]">MM / DD / YYYY</span>
        <span className="text-xs text-[var(--muted-foreground)]">📅</span>
      </div>
      <HelpText field={field} />
    </div>
  );
}

function SelectPreview({ field }: PreviewProps) {
  return (
    <div>
      <Label field={field} />
      <div className="h-8 rounded border border-[var(--border)] bg-[var(--background)] px-3 flex items-center justify-between">
        <span className="text-xs text-[var(--muted-foreground)]">
          {field.options.length > 0 ? field.options[0].label : 'Select…'}
        </span>
        <span className="text-xs text-[var(--muted-foreground)]">▾</span>
      </div>
      <HelpText field={field} />
    </div>
  );
}

function RadioPreview({ field }: PreviewProps) {
  const display = field.options.slice(0, 3);
  return (
    <div>
      <Label field={field} />
      <div className="flex flex-wrap gap-2 mt-1">
        {display.length > 0 ? display.map((opt) => (
          <div key={opt.id} className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded-full border border-[var(--border)] bg-[var(--background)] flex-shrink-0" />
            <span className="text-xs text-[var(--card-foreground)]">{opt.label}</span>
          </div>
        )) : (
          <span className="text-xs text-[var(--muted-foreground)]">No options yet</span>
        )}
        {field.options.length > 3 && (
          <span className="text-xs text-[var(--muted-foreground)]">+{field.options.length - 3} more</span>
        )}
      </div>
      <HelpText field={field} />
    </div>
  );
}

function CheckboxPreview({ field }: PreviewProps) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-4 h-4 mt-0.5 rounded border border-[var(--border)] bg-[var(--background)] flex-shrink-0" />
      <div>
        <span className="text-sm font-medium text-[var(--card-foreground)]">{field.label}</span>
        {field.is_required && <span className="text-red-500 text-xs ml-1">*</span>}
        <HelpText field={field} />
      </div>
    </div>
  );
}

function CheckboxGroupPreview({ field }: PreviewProps) {
  const display = field.options.slice(0, 3);
  return (
    <div>
      <Label field={field} />
      <div className="space-y-1 mt-1">
        {display.length > 0 ? display.map((opt) => (
          <div key={opt.id} className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded border border-[var(--border)] bg-[var(--background)] flex-shrink-0" />
            <span className="text-xs text-[var(--card-foreground)]">{opt.label}</span>
          </div>
        )) : (
          <span className="text-xs text-[var(--muted-foreground)]">No options yet</span>
        )}
        {field.options.length > 3 && (
          <span className="text-xs text-[var(--muted-foreground)]">+{field.options.length - 3} more</span>
        )}
      </div>
      <HelpText field={field} />
    </div>
  );
}

function YesNoPreview({ field }: PreviewProps) {
  return (
    <div>
      <Label field={field} />
      <div className="flex gap-3 mt-1">
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded-full border border-[var(--border)] bg-[var(--background)]" />
          <span className="text-xs text-[var(--card-foreground)]">Yes</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded-full border border-[var(--border)] bg-[var(--background)]" />
          <span className="text-xs text-[var(--card-foreground)]">No</span>
        </div>
      </div>
      <HelpText field={field} />
    </div>
  );
}

function FilePreview({ field }: PreviewProps) {
  return (
    <div>
      <Label field={field} />
      <div className="h-14 rounded border border-dashed border-[var(--border)] bg-[var(--background)] flex flex-col items-center justify-center gap-1">
        <Upload size={14} className="text-[var(--muted-foreground)]" />
        <span className="text-xs text-[var(--muted-foreground)]">Click to upload or drag file</span>
      </div>
      <HelpText field={field} />
    </div>
  );
}

function SignaturePreview({ field }: PreviewProps) {
  return (
    <div>
      <Label field={field} />
      <div className="h-16 rounded border border-[var(--border)] bg-[var(--background)] flex items-center justify-center gap-2">
        <PenLine size={14} className="text-[var(--muted-foreground)]" />
        <span className="text-xs text-[var(--muted-foreground)]">Sign here</span>
      </div>
      <HelpText field={field} />
    </div>
  );
}

function AddressPreview({ field }: PreviewProps) {
  return (
    <div>
      <Label field={field} />
      <div className="space-y-1.5 mt-1">
        <div className="h-7 rounded border border-[var(--border)] bg-[var(--background)] px-2 flex items-center">
          <span className="text-xs text-[var(--muted-foreground)]">Street Address</span>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 h-7 rounded border border-[var(--border)] bg-[var(--background)] px-2 flex items-center">
            <span className="text-xs text-[var(--muted-foreground)]">City</span>
          </div>
          <div className="w-20 h-7 rounded border border-[var(--border)] bg-[var(--background)] px-2 flex items-center">
            <span className="text-xs text-[var(--muted-foreground)]">State</span>
          </div>
          <div className="w-20 h-7 rounded border border-[var(--border)] bg-[var(--background)] px-2 flex items-center">
            <span className="text-xs text-[var(--muted-foreground)]">ZIP</span>
          </div>
        </div>
      </div>
      <HelpText field={field} />
    </div>
  );
}

function RepeaterPreview({ field }: PreviewProps) {
  return (
    <div>
      <Label field={field} />
      <div className="rounded border border-dashed border-[var(--border)] bg-[var(--background)] px-3 py-2">
        <span className="text-xs text-[var(--muted-foreground)]">Repeater group — configure sub-fields via edit</span>
      </div>
      <HelpText field={field} />
    </div>
  );
}

function DividerPreview() {
  return (
    <div className="flex items-center gap-3 py-2">
      <Minus size={14} className="text-[var(--muted-foreground)] flex-shrink-0" />
      <div className="flex-1 h-px bg-[var(--border)]" />
    </div>
  );
}

function SectionHeaderPreview({ field }: PreviewProps) {
  return (
    <div className="py-1">
      <p className="text-base font-semibold text-[var(--card-foreground)]" style={{ fontFamily: 'var(--font-headline)' }}>
        {field.label}
      </p>
      {field.help_text && (
        <p className="text-sm text-[var(--muted-foreground)] mt-0.5">{field.help_text}</p>
      )}
    </div>
  );
}

function EmailPreview({ field }: PreviewProps) {
  return (
    <div>
      <Label field={field} />
      <div className="h-8 rounded border border-[var(--border)] bg-[var(--background)] px-3 flex items-center">
        <span className="text-xs text-[var(--muted-foreground)]">{field.placeholder || 'you@example.com'}</span>
      </div>
      <HelpText field={field} />
    </div>
  );
}

function PhonePreview({ field }: PreviewProps) {
  return (
    <div>
      <Label field={field} />
      <div className="h-8 rounded border border-[var(--border)] bg-[var(--background)] px-3 flex items-center">
        <span className="text-xs text-[var(--muted-foreground)]">{field.placeholder || '(555) 000-0000'}</span>
      </div>
      <HelpText field={field} />
    </div>
  );
}

export function FieldPreviewWidget({ field }: PreviewProps) {
  switch (field.field_type) {
    case 'text':           return <TextPreview field={field} />;
    case 'textarea':       return <TextareaPreview field={field} />;
    case 'number':         return <NumberPreview field={field} />;
    case 'date':           return <DatePreview field={field} />;
    case 'select':         return <SelectPreview field={field} />;
    case 'radio':          return <RadioPreview field={field} />;
    case 'checkbox':       return <CheckboxPreview field={field} />;
    case 'checkbox_group': return <CheckboxGroupPreview field={field} />;
    case 'yesno':          return <YesNoPreview field={field} />;
    case 'file':           return <FilePreview field={field} />;
    case 'signature':      return <SignaturePreview field={field} />;
    case 'address':        return <AddressPreview field={field} />;
    case 'email':          return <EmailPreview field={field} />;
    case 'phone':          return <PhonePreview field={field} />;
    case 'repeater':       return <RepeaterPreview field={field} />;
    case 'divider':        return <DividerPreview />;
    case 'section_header': return <SectionHeaderPreview field={field} />;
    default:               return <TextPreview field={field} />;
  }
}
