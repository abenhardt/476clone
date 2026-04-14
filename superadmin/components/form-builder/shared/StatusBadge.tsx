import { CheckCircle2, Clock, Archive } from 'lucide-react';
import type { FormDefinitionStatus } from '@/features/forms/types/form.types';

export function StatusBadge({ status }: { status: FormDefinitionStatus }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
        <CheckCircle2 size={11} /> Active
      </span>
    );
  }
  if (status === 'draft') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
        <Clock size={11} /> Draft
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
      <Archive size={11} /> Archived
    </span>
  );
}
