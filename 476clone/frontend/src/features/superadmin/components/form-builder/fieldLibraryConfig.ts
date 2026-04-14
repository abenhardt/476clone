/**
 * fieldLibraryConfig.ts — Field type catalog for the Form Builder field library panel.
 *
 * Defines every supported field type with its display label, icon, group assignment,
 * and whether it requires an options list. Used by Panel 2 (Field Library).
 */

import type { LucideIcon } from 'lucide-react';
import {
  Type, AlignLeft, Mail, Phone, Hash, Calendar,
  ChevronDown, Circle, CheckSquare, ListChecks, ToggleLeft,
  Upload, PenLine, MapPin, Repeat2,
  Minus, Heading,
} from 'lucide-react';
import type { FieldType } from '@/features/forms/types/form.types';

export interface FieldLibraryConfig {
  type: FieldType;
  label: string;
  icon: LucideIcon;
  group: 'input' | 'choice' | 'upload_special' | 'layout';
  hasOptions: boolean;
}

export const FIELD_LIBRARY: FieldLibraryConfig[] = [
  // ── Input Fields ──────────────────────────────────────────────────────────
  { type: 'text',          label: 'Short Text',    icon: Type,         group: 'input',          hasOptions: false },
  { type: 'textarea',      label: 'Long Text',     icon: AlignLeft,    group: 'input',          hasOptions: false },
  { type: 'email',         label: 'Email',         icon: Mail,         group: 'input',          hasOptions: false },
  { type: 'phone',         label: 'Phone',         icon: Phone,        group: 'input',          hasOptions: false },
  { type: 'number',        label: 'Number',        icon: Hash,         group: 'input',          hasOptions: false },
  { type: 'date',          label: 'Date',          icon: Calendar,     group: 'input',          hasOptions: false },
  // ── Choice Fields ─────────────────────────────────────────────────────────
  { type: 'select',        label: 'Dropdown',      icon: ChevronDown,  group: 'choice',         hasOptions: true  },
  { type: 'radio',         label: 'Radio Group',   icon: Circle,       group: 'choice',         hasOptions: true  },
  { type: 'checkbox',      label: 'Checkbox',      icon: CheckSquare,  group: 'choice',         hasOptions: false },
  { type: 'checkbox_group',label: 'Multi-Select',  icon: ListChecks,   group: 'choice',         hasOptions: true  },
  { type: 'yesno',         label: 'Yes / No',      icon: ToggleLeft,   group: 'choice',         hasOptions: false },
  // ── Upload & Special ──────────────────────────────────────────────────────
  { type: 'file',          label: 'File Upload',   icon: Upload,       group: 'upload_special', hasOptions: false },
  { type: 'signature',     label: 'Signature',     icon: PenLine,      group: 'upload_special', hasOptions: false },
  { type: 'address',       label: 'Address',       icon: MapPin,       group: 'upload_special', hasOptions: false },
  { type: 'repeater',      label: 'Repeater',      icon: Repeat2,      group: 'upload_special', hasOptions: false },
  // ── Layout Elements ───────────────────────────────────────────────────────
  { type: 'divider',        label: 'Divider',       icon: Minus,        group: 'layout',         hasOptions: false },
  { type: 'section_header', label: 'Section Header',icon: Heading,      group: 'layout',         hasOptions: false },
];

export const GROUP_LABELS: Record<string, string> = {
  input:          'Input Fields',
  choice:         'Choice Fields',
  upload_special: 'Upload & Special',
  layout:         'Layout Elements',
};

export const OPTION_TYPES: FieldType[] = ['select', 'radio', 'checkbox_group'];

export const DEFAULT_LABELS: Partial<Record<FieldType, string>> = {
  text:           'Text Field',
  textarea:       'Long Text',
  email:          'Email Address',
  phone:          'Phone Number',
  number:         'Number',
  date:           'Date',
  select:         'Dropdown',
  radio:          'Radio Group',
  checkbox:       'Checkbox',
  checkbox_group: 'Multi-Select',
  yesno:          'Yes / No',
  file:           'File Upload',
  signature:      'Signature',
  address:        'Address',
  repeater:       'Repeater',
  divider:        'Divider',
  section_header: 'Section Header',
};
