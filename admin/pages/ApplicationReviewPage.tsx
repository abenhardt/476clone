/**
 * ApplicationReviewPage.tsx
 *
 * Purpose: Full application detail view for admins to review and decide on a camper's application.
 * Route: /admin/applications/:id
 *
 * Responsibilities:
 *  - Load a single application with all its nested relations (camper, medical, documents, etc.).
 *  - Show camper info, guardian, medical summary, emergency contacts, behavioral profile,
 *    feeding plan, assistive devices, activity permissions, uploaded documents, and signature.
 *  - Provide a sticky ReviewPanel (sidebar) where admin can approve, reject, or mark under-review.
 *  - Before approving, check camper compliance; if incomplete, show a bypass dialog.
 *  - Allow downloading attached documents using the blob download pattern.
 *
 * Plain-English summary:
 *  Think of this as the "full application packet" an admin reads before deciding yes or no.
 *  The left column shows all the details the parent filled in. The right column (sticky) has the
 *  approve / reject / under-review buttons. If the application is missing required documents,
 *  a warning dialog pops up before the admin can approve — they can still bypass it if needed.
 */

import { useState, useEffect, useRef, type ReactNode, type CSSProperties } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import {
  ArrowLeft, User, FileText, Heart, Pill, AlertTriangle,
  CheckCircle, XCircle, Clock, Download, Eye,
  Phone, Brain, Utensils, Wrench, Activity,
  Users, PenLine, Stethoscope, ListOrdered, Pencil, Save, X as XIcon, ShieldCheck,
  Plus, Trash2, Upload,
} from 'lucide-react';

import {
  getApplication, reviewApplication, checkApplicationCompleteness, updateApplication,
  updateCamper, updateEmergencyContact, createEmergencyContact, deleteEmergencyContact,
  updateBehavioralProfile, uploadDocumentOnBehalf, verifyDocument, getCamperComplianceStatus,
} from '@/features/admin/api/admin.api';
import type { ComplianceRequiredDoc } from '@/features/admin/api/admin.api';
import type {
  UpdateApplicationPayload, UpdateCamperPayload, UpdateEmergencyContactPayload,
  CreateEmergencyContactPayload, UpdateBehavioralProfilePayload,
} from '@/features/admin/api/admin.api';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { Button } from '@/ui/components/Button';
import { Skeletons } from '@/ui/components/Skeletons';
import { EmptyState } from '@/ui/components/EmptyState';
import { axiosInstance } from '@/api/axios.config';
import { ROUTES } from '@/shared/constants/routes';
import type { Application, ApplicationCompleteness, BehavioralProfile, Camper, EmergencyContact } from '@/features/admin/types/admin.types';
import { IncompleteApprovalModal } from '@/features/admin/components/IncompleteApprovalModal';
import {
  getDocumentLabel,
  isRequiredDocumentType,
  UNIVERSAL_REQUIRED_DOC_TYPES,
} from '@/shared/constants/documentRequirements';

// ---------------------------------------------------------------------------
// Section card wrapper
// ---------------------------------------------------------------------------

// Reusable card with an icon and title — wraps each logical section of the application.
interface SectionCardProps {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  /** Optional button / action shown flush-right in the card header. */
  headerAction?: ReactNode;
}

function SectionCard({ title, icon, children, headerAction }: SectionCardProps) {
  return (
    <div
      className="rounded-xl p-6 border"
      style={{
        background: 'var(--glass-medium)',
        borderColor: 'var(--border)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div
          className="flex items-center justify-center w-8 h-8 rounded-lg"
          style={{ background: 'rgba(22,163,74,0.12)' }}
        >
          <span style={{ color: 'var(--ember-orange)' }}>{icon}</span>
        </div>
        <h3 className="font-headline font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
          {title}
        </h3>
        {headerAction && <div className="ml-auto">{headerAction}</div>}
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared edit helpers
// ---------------------------------------------------------------------------

/** Reusable "Edit" trigger button used in section card headers. */
function EditBtn({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
      style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
    >
      <Pencil style={{ width: 11, height: 11 }} />
      Edit
    </button>
  );
}

/** Inline Save / Cancel row used within any edit form. */
function SaveCancelRow({
  onSave,
  onCancel,
  saving,
  hasChanges,
}: {
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  hasChanges?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 mt-4 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
      <Button
        onClick={onSave}
        loading={saving}
        disabled={saving || hasChanges === false}
        variant="primary"
        icon={<Save className="h-3.5 w-3.5" />}
      >
        Save Changes
      </Button>
      <Button onClick={onCancel} disabled={saving} variant="ghost" icon={<XIcon className="h-3.5 w-3.5" />}>
        Cancel
      </Button>
    </div>
  );
}

/** Warning banner shown when editing an application in a restricted status. */
function EditStatusWarning({ status }: { status: string }) {
  return (
    <div
      className="flex items-start gap-2 rounded-lg px-3 py-2 mb-4 border"
      style={{ background: 'rgba(234,88,12,0.07)', borderColor: 'rgba(234,88,12,0.2)' }}
    >
      <AlertTriangle style={{ width: 13, height: 13, color: '#ea580c', flexShrink: 0, marginTop: 1 }} />
      <p className="text-xs leading-snug" style={{ color: '#ea580c' }}>
        This application is <strong>{status}</strong>. Changes are permitted and will be recorded in the audit log.
      </p>
    </div>
  );
}

const RESTRICTED_EDIT_STATUSES = new Set(['approved', 'rejected', 'cancelled', 'withdrawn', 'waitlisted']);

/** Shared input style used in all inline edit forms. */
const inputStyle: CSSProperties = {
  width: '100%',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)',
  background: 'var(--input)',
  color: 'var(--foreground)',
  fontFamily: 'var(--font-body)',
  fontSize: 'var(--text-sm)',
  padding: '6px 10px',
  outline: 'none',
};

// ---------------------------------------------------------------------------
// CamperEditSection — inline edit for camper basic info
// ---------------------------------------------------------------------------

interface CamperEditSectionProps {
  camper: Camper;
  appStatus: Application['status'];
  session?: Application['session'];
  /** Second-choice session; shown read-only so reviewer sees the full applicant preference. */
  sessionSecond?: Application['second_session'];
  firstApplication?: boolean;
  attendedBefore?: boolean;
  onCamperSaved: (updated: Camper) => void;
}

function CamperEditSection({ camper, appStatus, session, sessionSecond, firstApplication, attendedBefore, onCamperSaved }: CamperEditSectionProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<UpdateCamperPayload>({});

  function startEdit() {
    setDraft({
      first_name:     camper.first_name,
      last_name:      camper.last_name,
      preferred_name: camper.preferred_name ?? '',
      date_of_birth:  camper.date_of_birth ?? '',
      gender:         camper.gender ?? '',
      tshirt_size:    camper.tshirt_size ?? '',
    });
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setDraft({});
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await updateCamper(camper.id, draft);
      onCamperSaved(updated);
      setEditing(false);
      setDraft({});
      toast.success('Camper information updated.');
    } catch {
      toast.error('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // Build location string from non-encrypted address parts (street address is PHI-hidden by backend)
  const camperLocation = [camper.applicant_city, camper.applicant_state, camper.applicant_zip]
    .filter(Boolean).join(', ');

  const viewRows: [string, string | undefined][] = [
    [t('admin.review.field_name'),    camper.full_name],
    ...(camper.preferred_name ? [['Preferred Name', camper.preferred_name] as [string, string]] : []),
    [t('admin.review.field_dob'),     camper.date_of_birth ? format(new Date(camper.date_of_birth), 'MMM d, yyyy') : undefined],
    [t('admin.review.field_gender'),  camper.gender],
    [t('admin.review.field_shirt'),   camper.tshirt_size],
    ['County',                        camper.county],
    ...(camperLocation ? [['City / State / Zip', camperLocation] as [string, string]] : []),
    ...(camper.needs_interpreter ? [['Interpreter Needed', `Yes — ${camper.preferred_language ?? 'language not specified'}`] as [string, string]] : []),
    [t('admin.review.field_session'), session?.name],
    [t('admin.review.field_camp'),    session?.camp?.name],
    ...(sessionSecond ? [['2nd Choice Session', sessionSecond.name] as [string, string]] : []),
    // Application history flags — shown so reviewer knows whether this is a new vs returning applicant
    ...(firstApplication != null ? [['First Application', firstApplication ? 'Yes — first-time applicant' : 'No'] as [string, string]] : []),
    ...(attendedBefore != null ? [['Previously Attended', attendedBefore ? 'Yes — has attended before' : 'No'] as [string, string]] : []),
  ];

  return (
    <SectionCard
      title={t('admin.review.camper_info')}
      icon={<User className="h-4 w-4" />}
      headerAction={!editing ? <EditBtn onClick={startEdit} /> : undefined}
    >
      {editing ? (
        <div>
          {RESTRICTED_EDIT_STATUSES.has(appStatus) && <EditStatusWarning status={appStatus} />}
          <div className="grid grid-cols-2 gap-3">
            {([
              ['First Name',      'first_name',     'text'],
              ['Last Name',       'last_name',       'text'],
              ['Preferred Name',  'preferred_name',  'text'],
              ['Date of Birth',   'date_of_birth',   'date'],
              ['Gender',          'gender',          'text'],
              ['T-Shirt Size',    'tshirt_size',     'text'],
            ] as [string, keyof UpdateCamperPayload, string][]).map(([label, key, type]) => (
              <div key={key}>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
                  {label}
                </label>
                <input
                  type={type}
                  value={(draft[key] ?? '') as string}
                  onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                  style={inputStyle}
                />
              </div>
            ))}
          </div>
          <SaveCancelRow onSave={handleSave} onCancel={cancelEdit} saving={saving} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 text-sm">
          {viewRows.map(([label, value]) => (
            <div key={label as string}>
              <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
              <p style={{ color: 'var(--foreground)' }}>{value ?? t('common.not_provided')}</p>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// EmergencyContactsSection — inline edit for emergency contacts
// ---------------------------------------------------------------------------

interface EmergencyContactsSectionProps {
  contacts: EmergencyContact[];
  camperId: number;
  appStatus: Application['status'];
  onContactsChanged: (contacts: EmergencyContact[]) => void;
}

function EmergencyContactsSection({ contacts, camperId, appStatus, onContactsChanged }: EmergencyContactsSectionProps) {
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [draft, setDraft] = useState<Partial<CreateEmergencyContactPayload>>({});

  function startEdit(contact: EmergencyContact) {
    setDraft({
      name:                contact.name,
      relationship:        contact.relationship,
      phone_primary:       contact.phone_primary,
      phone_secondary:     contact.phone_secondary ?? '',
      email:               contact.email ?? '',
      is_authorized_pickup: contact.is_authorized_pickup ?? false,
    });
    setEditingId(contact.id);
  }

  function startNew() {
    setDraft({ camper_id: camperId, name: '', relationship: '', phone_primary: '' });
    setEditingId('new');
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft({});
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editingId === 'new') {
        const created = await createEmergencyContact(draft as CreateEmergencyContactPayload);
        onContactsChanged([...contacts, created]);
        toast.success('Emergency contact added.');
      } else {
        const updated = await updateEmergencyContact(editingId as number, draft as UpdateEmergencyContactPayload);
        onContactsChanged(contacts.map((c) => (c.id === editingId ? updated : c)));
        toast.success('Emergency contact updated.');
      }
      setEditingId(null);
      setDraft({});
    } catch {
      toast.error('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Remove this emergency contact? This cannot be undone.')) return;
    setDeleting(id);
    try {
      await deleteEmergencyContact(id);
      onContactsChanged(contacts.filter((c) => c.id !== id));
      toast.success('Emergency contact removed.');
    } catch {
      toast.error('Failed to remove contact.');
    } finally {
      setDeleting(null);
    }
  }

  const editFields: [string, keyof typeof draft, string][] = [
    ['Name',             'name',             'text'],
    ['Relationship',     'relationship',     'text'],
    ['Primary Phone',    'phone_primary',    'tel'],
    ['Secondary Phone',  'phone_secondary',  'tel'],
    ['Email',            'email',            'email'],
  ];

  return (
    <SectionCard
      title="Emergency Contacts"
      icon={<Phone className="h-4 w-4" />}
      headerAction={
        editingId === null ? (
          <button
            type="button"
            onClick={startNew}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
          >
            <Plus style={{ width: 11, height: 11 }} />
            Add
          </button>
        ) : undefined
      }
    >
      {RESTRICTED_EDIT_STATUSES.has(appStatus) && editingId !== null && <EditStatusWarning status={appStatus} />}

      {/* Add-new form */}
      {editingId === 'new' && (
        <div className="rounded-lg p-4 mb-3 border" style={{ borderColor: 'var(--border)', background: 'rgba(22,163,74,0.04)' }}>
          <p className="text-xs font-semibold mb-3" style={{ color: 'var(--ember-orange)' }}>New Emergency Contact</p>
          <div className="grid grid-cols-2 gap-3">
            {editFields.map(([label, key, type]) => (
              <div key={key as string}>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>{label}</label>
                <input
                  type={type}
                  value={(draft[key] ?? '') as string}
                  onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                  style={inputStyle}
                />
              </div>
            ))}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="new-pickup"
                checked={!!draft.is_authorized_pickup}
                onChange={(e) => setDraft((d) => ({ ...d, is_authorized_pickup: e.target.checked }))}
              />
              <label htmlFor="new-pickup" className="text-sm" style={{ color: 'var(--foreground)' }}>
                Authorized for pickup
              </label>
            </div>
          </div>
          <SaveCancelRow onSave={handleSave} onCancel={cancelEdit} saving={saving} />
        </div>
      )}

      {/* Contact list */}
      {contacts.length === 0 && editingId !== 'new' && (
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No emergency contacts on file.</p>
      )}
      <div className="space-y-3">
        {contacts.map((ec) =>
          editingId === ec.id ? (
            // Edit mode for this contact
            <div key={ec.id} className="rounded-lg p-4 border" style={{ borderColor: 'var(--ember-orange)', background: 'rgba(22,163,74,0.04)' }}>
              <div className="grid grid-cols-2 gap-3">
                {editFields.map(([label, key, type]) => (
                  <div key={key as string}>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>{label}</label>
                    <input
                      type={type}
                      value={(draft[key] ?? '') as string}
                      onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`pickup-${ec.id}`}
                    checked={!!draft.is_authorized_pickup}
                    onChange={(e) => setDraft((d) => ({ ...d, is_authorized_pickup: e.target.checked }))}
                  />
                  <label htmlFor={`pickup-${ec.id}`} className="text-sm" style={{ color: 'var(--foreground)' }}>
                    Authorized for pickup
                  </label>
                </div>
              </div>
              <SaveCancelRow onSave={handleSave} onCancel={cancelEdit} saving={saving} />
            </div>
          ) : (
            // View mode for this contact
            <div key={ec.id} className="glass-card rounded-lg p-3 group relative">
              {/* Role badges — guardian contacts are distinguished from emergency-only contacts */}
              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                {ec.is_guardian && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                    style={{ background: 'rgba(99,102,241,0.12)', color: 'rgb(99,102,241)' }}>
                    Guardian
                  </span>
                )}
                {ec.is_primary && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                    style={{ background: 'rgba(22,163,74,0.12)', color: '#16a34a' }}>
                    Primary
                  </span>
                )}
                {ec.is_authorized_pickup && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                    style={{ background: 'rgba(202,138,4,0.12)', color: '#ca8a04' }}>
                    Authorized Pickup
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>Name</p>
                  <p style={{ color: 'var(--foreground)' }}>{ec.name}</p>
                </div>
                <div>
                  <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>Relationship</p>
                  <p style={{ color: 'var(--foreground)' }}>{ec.relationship}</p>
                </div>
                <div>
                  <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>Primary Phone</p>
                  <p style={{ color: 'var(--foreground)' }}>{ec.phone_primary}</p>
                </div>
                {ec.phone_secondary && (
                  <div>
                    <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>Secondary Phone</p>
                    <p style={{ color: 'var(--foreground)' }}>{ec.phone_secondary}</p>
                  </div>
                )}
                {ec.phone_work && (
                  <div>
                    <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>Work Phone</p>
                    <p style={{ color: 'var(--foreground)' }}>{ec.phone_work}</p>
                  </div>
                )}
                {ec.email && (
                  <div>
                    <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>Email</p>
                    <p style={{ color: 'var(--foreground)' }}>{ec.email}</p>
                  </div>
                )}
                {(ec.city || ec.state) && (
                  <div>
                    <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>City / State</p>
                    <p style={{ color: 'var(--foreground)' }}>{[ec.city, ec.state].filter(Boolean).join(', ')}</p>
                  </div>
                )}
                {ec.primary_language && ec.primary_language !== 'English' && (
                  <div>
                    <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>Language</p>
                    <p style={{ color: 'var(--foreground)' }}>
                      {ec.primary_language}{ec.interpreter_needed ? ' — interpreter needed' : ''}
                    </p>
                  </div>
                )}
              </div>
              {/* Edit / Delete buttons on hover */}
              <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <EditBtn onClick={() => startEdit(ec)} disabled={editingId !== null} />
                <button
                  type="button"
                  onClick={() => handleDelete(ec.id)}
                  disabled={deleting === ec.id || editingId !== null}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors"
                  style={{ borderColor: 'rgba(220,38,38,0.3)', color: 'var(--destructive)', background: 'rgba(220,38,38,0.04)' }}
                >
                  {deleting === ec.id ? (
                    <span>...</span>
                  ) : (
                    <Trash2 style={{ width: 11, height: 11 }} />
                  )}
                </button>
              </div>
            </div>
          ),
        )}
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// BehavioralProfileEditSection — inline edit for behavioral profile
// ---------------------------------------------------------------------------

interface BehavioralProfileEditSectionProps {
  profile: BehavioralProfile;
  appStatus: Application['status'];
  onProfileSaved: (updated: BehavioralProfile) => void;
}

function BehavioralProfileEditSection({ profile, appStatus, onProfileSaved }: BehavioralProfileEditSectionProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<UpdateBehavioralProfilePayload>({});

  function startEdit() {
    setDraft({
      triggers:                  profile.triggers ?? '',
      de_escalation_strategies:  profile.de_escalation_strategies ?? '',
      communication_style:       profile.communication_style ?? '',
      notes:                     profile.notes ?? '',
    });
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setDraft({});
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await updateBehavioralProfile(profile.id, draft);
      onProfileSaved(updated);
      setEditing(false);
      setDraft({});
      toast.success('Behavioral profile updated.');
    } catch {
      toast.error('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const textareaStyle: CSSProperties = {
    ...inputStyle,
    resize: 'vertical',
    minHeight: 72,
  };

  const textFields: [string, keyof UpdateBehavioralProfilePayload][] = [
    ['Triggers',                   'triggers'],
    ['De-escalation Strategies',   'de_escalation_strategies'],
    ['Communication Style',        'communication_style'],
    ['Notes',                      'notes'],
  ];

  return (
    <SectionCard
      title="Development & Behavior"
      icon={<Brain className="h-4 w-4" />}
      headerAction={!editing ? <EditBtn onClick={startEdit} /> : undefined}
    >
      {editing ? (
        <div>
          {RESTRICTED_EDIT_STATUSES.has(appStatus) && <EditStatusWarning status={appStatus} />}
          <div className="space-y-3">
            {textFields.map(([label, key]) => (
              <div key={key as string}>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>{label}</label>
                <textarea
                  value={(draft[key] ?? '') as string}
                  onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                  rows={3}
                  style={textareaStyle}
                />
              </div>
            ))}
          </div>
          <SaveCancelRow onSave={handleSave} onCancel={cancelEdit} saving={saving} />
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          {/* Safety-critical flags — shown prominently at the top */}
          {(() => {
            const criticalFlags: [string, boolean | undefined, string | undefined][] = [
              ['Aggression',             profile.aggression,             profile.aggression_description],
              ['Self-Harm Behaviors',    profile.self_abuse,             profile.self_abuse_description],
              ['Wandering / Elopement Risk', profile.wandering_risk,     profile.wandering_description],
              ['One-to-One Supervision Required', profile.one_to_one_supervision, profile.one_to_one_description],
              ['Sexual Behaviors',       profile.sexual_behaviors,       profile.sexual_behaviors_description],
            ].filter(([, val]) => val) as [string, boolean, string | undefined][];

            if (criticalFlags.length === 0) return null;
            return (
              <div
                className="rounded-lg p-3 border mb-1"
                style={{ background: 'rgba(220,38,38,0.05)', borderColor: 'rgba(220,38,38,0.18)' }}
              >
                <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--destructive)' }}>
                  Safety Flags
                </p>
                <div className="space-y-1.5">
                  {criticalFlags.map(([label, , desc]) => (
                    <div key={label} className="flex items-start gap-2">
                      <span className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full" style={{ background: 'var(--destructive)', marginTop: 5 }} />
                      <div>
                        <span className="font-medium text-xs" style={{ color: 'var(--destructive)' }}>{label}</span>
                        {desc && <span className="text-xs ml-2" style={{ color: 'var(--foreground)' }}>{desc}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Functional status flags */}
          {(() => {
            const functionalItems: [string, boolean | undefined][] = [
              ['One-to-One Supervision',  profile.one_to_one_supervision],
              ['Behavior Support Plan',   profile.behavior_plan],
              ['Developmental Delay',     profile.developmental_delay],
              ['Verbal Communication',    profile.verbal_communication],
              ['Independent Mobility',    profile.independent_mobility],
              ['Functional Reading',      profile.functional_reading],
              ['Functional Writing',      profile.functional_writing],
              ['Social Skills',           profile.social_skills],
              ['Attends School',          profile.attends_school],
              ['Interpersonal Behaviors', profile.interpersonal_behavior],
              ['Social-Emotional Needs',  profile.social_emotional],
              ['Follows Instructions',    profile.follows_instructions],
              ['Group Participation',     profile.group_participation],
            ].filter(([, v]) => v != null) as [string, boolean][];

            const presentFlags = functionalItems.filter(([, v]) => v);
            if (presentFlags.length === 0) return null;
            return (
              <div>
                <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--muted-foreground)' }}>Functional Status</p>
                <div className="flex flex-wrap gap-1.5">
                  {presentFlags.map(([label]) => (
                    <span
                      key={label}
                      className="text-xs px-2 py-0.5 rounded-full border"
                      style={{ background: 'rgba(22,163,74,0.08)', borderColor: 'rgba(22,163,74,0.25)', color: 'var(--warm-amber)' }}
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Functioning age level */}
          {profile.functioning_age_level && (
            <div>
              <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>Functioning Age Level</p>
              <p style={{ color: 'var(--foreground)' }}>{profile.functioning_age_level}</p>
            </div>
          )}

          {/* Communication methods */}
          {profile.communication_methods && profile.communication_methods.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Communication Methods</p>
              <div className="flex flex-wrap gap-1.5">
                {profile.communication_methods.map((m) => (
                  <span
                    key={m}
                    className="text-xs px-2 py-0.5 rounded-full border"
                    style={{ borderColor: 'var(--border)', color: 'var(--foreground)', background: 'var(--card)' }}
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Classroom type */}
          {profile.attends_school && profile.classroom_type && (
            <div>
              <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>Classroom Type</p>
              <p style={{ color: 'var(--foreground)' }}>{profile.classroom_type}</p>
            </div>
          )}

          {/* Narrative text fields */}
          {([
            ['Triggers',                  profile.triggers],
            ['De-escalation Strategies',  profile.de_escalation_strategies],
            ['Communication Style',       profile.communication_style],
            ['Notes',                     profile.notes],
          ] as [string, string | undefined][]).filter(([, v]) => v).map(([label, value]) => (
            <div key={label}>
              <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
              <p className="whitespace-pre-wrap" style={{ color: 'var(--foreground)' }}>{value}</p>
            </div>
          ))}

          {!profile.triggers && !profile.de_escalation_strategies && !profile.communication_style && !profile.notes
            && !profile.aggression && !profile.self_abuse && !profile.wandering_risk && !profile.one_to_one_supervision
            && !profile.developmental_delay && !profile.behavior_plan && (
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No behavioral profile data on file.</p>
          )}
        </div>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// NarrativesSection — inline narratives editor (replaces EditNarrativesPanel)
// ---------------------------------------------------------------------------

// Each narrative field preserves the exact question the applicant was asked so the reviewer
// sees both what was asked and what was answered — no information loss through abbreviation.
const NARRATIVE_FIELDS: { key: keyof UpdateApplicationPayload; label: string; question: string }[] = [
  {
    key: 'narrative_rustic_environment',
    label: 'Rustic Environment',
    question: 'Is a rustic outdoor environment (heat, bugs, uneven terrain, limited AC) suitable for your camper? Please explain any concerns.',
  },
  {
    key: 'narrative_staff_suggestions',
    label: 'Staff Suggestions',
    question: 'What suggestions do you have for camp staff to best support your camper\'s unique needs during activities and daily routines?',
  },
  {
    key: 'narrative_participation_concerns',
    label: 'Participation Concerns',
    question: 'Are there any specific activities or situations that concern you regarding your camper\'s participation?',
  },
  {
    key: 'narrative_camp_benefit',
    label: 'Camp Benefit',
    question: 'How do you believe attending camp will benefit your camper? What goals or outcomes are you hoping for?',
  },
  {
    key: 'narrative_heat_tolerance',
    label: 'Heat Tolerance',
    question: 'Please describe your camper\'s tolerance for heat and sun exposure, and any precautions staff should take.',
  },
  {
    key: 'narrative_transportation',
    label: 'Transportation',
    question: 'Are there any concerns or special accommodations needed regarding transportation to and from camp?',
  },
  {
    key: 'narrative_additional_info',
    label: 'Additional Information',
    question: 'Is there any additional information about your camper that camp staff should know that has not been covered elsewhere?',
  },
  {
    key: 'narrative_emergency_protocols',
    label: 'Emergency Protocols',
    question: 'Are there any special emergency procedures or protocols specific to your camper\'s condition that staff must follow?',
  },
];

interface NarrativesSectionProps {
  application: Application;
  onSaved: (updated: Application) => void;
}

function NarrativesSection({ application, onSaved }: NarrativesSectionProps) {
  const { t } = useTranslation();

  function buildInitial(): UpdateApplicationPayload {
    return {
      notes:                            application.notes                            ?? '',
      narrative_rustic_environment:     application.narrative_rustic_environment     ?? '',
      narrative_staff_suggestions:      application.narrative_staff_suggestions      ?? '',
      narrative_participation_concerns: application.narrative_participation_concerns ?? '',
      narrative_camp_benefit:           application.narrative_camp_benefit           ?? '',
      narrative_heat_tolerance:         application.narrative_heat_tolerance         ?? '',
      narrative_transportation:         application.narrative_transportation         ?? '',
      narrative_additional_info:        application.narrative_additional_info        ?? '',
      narrative_emergency_protocols:    application.narrative_emergency_protocols    ?? '',
    };
  }

  const [editing, setEditing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState<UpdateApplicationPayload>(buildInitial);
  const [values, setValues]     = useState<UpdateApplicationPayload>(buildInitial);

  // Sync when the application record refreshes externally
  useEffect(() => {
    const initial = buildInitial();
    setSaved(initial);
    setValues(initial);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [application.id]);

  const hasChanges = (Object.keys(values) as (keyof UpdateApplicationPayload)[]).some(
    (k) => values[k] !== saved[k],
  );

  function handleDiscard() {
    setValues(saved);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await updateApplication(application.id, values);
      onSaved(updated);
      setSaved(values);
      setEditing(false);
      toast.success(t('admin.review.edit_saved', 'Changes saved and logged.'));
    } catch {
      toast.error(t('common.save_error', 'Failed to save. Please try again.'));
    } finally {
      setSaving(false);
    }
  }

  const textareaStyle: CSSProperties = {
    ...inputStyle,
    fontSize: 'var(--text-xs)',
    resize: 'vertical',
    minHeight: 60,
  };

  const isRestricted = RESTRICTED_EDIT_STATUSES.has(application.status ?? '');

  const hasAnyContent = NARRATIVE_FIELDS.some((f) => application[f.key]);

  return (
    <SectionCard
      title="About Your Camper"
      icon={<PenLine className="h-4 w-4" />}
      headerAction={
        !editing ? (
          <EditBtn onClick={() => setEditing(true)} />
        ) : hasChanges ? (
          <button
            type="button"
            onClick={handleDiscard}
            className="text-xs px-2 py-1 rounded"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Discard
          </button>
        ) : undefined
      }
    >
      {editing ? (
        <div>
          {isRestricted && <EditStatusWarning status={application.status} />}

          {/* Admin Notes — internal only, not visible to applicants */}
          <div className="mb-3">
            <label htmlFor="admin-internal-notes" className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
              Internal Admin Notes
              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(99,102,241,0.1)', color: 'rgb(99,102,241)' }}>
                Staff only
              </span>
            </label>
            <textarea
              id="admin-internal-notes"
              value={values.notes ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
              rows={3}
              placeholder="Internal notes visible only to admin staff…"
              style={textareaStyle}
            />
          </div>

          {/* Narrative response fields */}
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted-foreground)' }}>Narrative Responses</p>
          <div className="space-y-3">
            {NARRATIVE_FIELDS.map(({ key, label, question }) => (
              <div key={key}>
                <label className="block text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  {label}
                  {hasChanges && values[key] !== saved[key] && (
                    <span
                      title="Unsaved change"
                      style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--ember-orange)', marginLeft: 5 }}
                    />
                  )}
                </label>
                <p className="text-xs italic mb-1" style={{ color: 'var(--muted-foreground)', opacity: 0.7 }}>{question}</p>
                <textarea
                  value={values[key] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                  rows={2}
                  style={textareaStyle}
                />
              </div>
            ))}
          </div>

          <SaveCancelRow onSave={handleSave} onCancel={() => setEditing(false)} saving={saving} />
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          {/* Show admin notes if present */}
          {application.notes && (
            <div>
              <p className="text-xs font-medium mb-0.5 flex items-center gap-1.5" style={{ color: 'var(--muted-foreground)' }}>
                Internal Admin Notes
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(99,102,241,0.1)', color: 'rgb(99,102,241)' }}>Staff only</span>
              </p>
              <p className="whitespace-pre-wrap" style={{ color: 'var(--foreground)' }}>{application.notes}</p>
            </div>
          )}
          {hasAnyContent ? (
            NARRATIVE_FIELDS.filter((f) => application[f.key]).map(({ key, label, question }) => (
              <div key={key}>
                <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
                {/* Show the exact question the applicant was asked — the reviewer sees what was asked, not just an abbreviated label */}
                <p className="text-xs italic mb-1.5" style={{ color: 'var(--muted-foreground)', opacity: 0.75 }}>{question}</p>
                <p className="whitespace-pre-wrap text-sm" style={{ color: 'var(--foreground)' }}>{application[key]}</p>
              </div>
            ))
          ) : !application.notes ? (
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No narrative responses recorded.</p>
          ) : null}
        </div>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// ReviewPanel
// ---------------------------------------------------------------------------

interface ReviewPanelProps {
  applicationId: number;
  currentStatus: Application['status'];
  // Callback fired after a successful review — updates the parent's application state.
  onReviewed: (updated: Application) => void;
}

function ReviewPanel({ applicationId, currentStatus, onReviewed }: ReviewPanelProps) {
  const { t } = useTranslation();
  const [notes, setNotes] = useState('');
  // Tracks which action is in-flight; typed to all valid admin review statuses.
  const [submitting, setSubmitting] = useState<
    'approved' | 'rejected' | 'under_review' | 'waitlisted' | 'cancelled' | null
  >(null);
  // Completeness modal state — null means closed.
  const [completenessReport, setCompletenessReport] = useState<ApplicationCompleteness | null>(null);

  /**
   * For non-approval actions (reject, under_review, waitlist, cancel) proceed immediately.
   * For "approved": first fetch the completeness report. If the application is complete,
   * approve directly. If incomplete, show the warning modal and let the admin decide.
   */
  async function handleReview(status: 'approved' | 'rejected' | 'under_review' | 'waitlisted' | 'cancelled') {
    if (status !== 'approved') {
      await submitReview(status);
      return;
    }

    // Approval path — run completeness check first.
    setSubmitting('approved');
    try {
      const report = await checkApplicationCompleteness(applicationId);
      if (report.is_complete) {
        // All good — proceed without showing the modal.
        await submitReview('approved');
      } else {
        // Surface the warning modal; suspend the submitting state so buttons re-enable.
        setSubmitting(null);
        setCompletenessReport(report);
      }
    } catch {
      setSubmitting(null);
      toast.error(t('admin.review.error'));
    }
  }

  /** Called after admin clicks "Approve Anyway" in the warning modal. */
  async function handleOverrideApprove() {
    if (! completenessReport) return;
    setSubmitting('approved');
    try {
      const updated = await reviewApplication(applicationId, {
        status: 'approved',
        notes,
        override_incomplete: true,
        missing_summary: {
          missing_fields:       completenessReport.missing_fields,
          missing_documents:    completenessReport.missing_documents,
          unverified_documents: completenessReport.unverified_documents ?? [],
          missing_consents:     completenessReport.missing_consents,
        },
      });
      setCompletenessReport(null);
      onReviewed(updated);
      toast.success(t('admin.review.success', { status: 'approved' }));
    } catch (err) {
      const msg = (err as { message?: string })?.message;
      toast.error(msg ?? t('admin.review.error'));
    } finally {
      setSubmitting(null);
    }
  }

  /** Direct review submit — used by non-approval actions and the complete-approval path. */
  async function submitReview(status: 'approved' | 'rejected' | 'under_review' | 'waitlisted' | 'cancelled') {
    setSubmitting(status);
    try {
      const updated = await reviewApplication(applicationId, { status, notes });
      onReviewed(updated);
      toast.success(t('admin.review.success', { status }));
    } catch (err) {
      const msg = (err as { message?: string })?.message;
      toast.error(msg ?? t('admin.review.error'));
    } finally {
      setSubmitting(null);
    }
  }

  // Terminal states have no valid admin actions.
  const isTerminal = currentStatus === 'cancelled' || currentStatus === 'withdrawn';

  return (
    <>
      {/* Completeness warning modal — rendered at the ReviewPanel level so it overlays the full page */}
      {completenessReport && (
        <IncompleteApprovalModal
          completeness={completenessReport}
          submitting={submitting === 'approved'}
          onClose={() => setCompletenessReport(null)}
          onApprove={handleOverrideApprove}
        />
      )}
      {/* Sticky card — stays visible as admin scrolls through application details. */}
      <div className="glass-panel rounded-xl p-6 sticky top-6">
        <h3 className="font-headline font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
          {t('admin.review.title')}
        </h3>

        <div className="mb-4">
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
            {t('admin.review.current_status')}
          </p>
          <StatusBadge status={currentStatus} />
        </div>

        {/* Terminal state — no further actions possible. */}
        {isTerminal ? (
          <div
            className="rounded-lg p-4 text-sm"
            style={{ background: 'rgba(107,114,128,0.08)', color: 'var(--muted-foreground)' }}
          >
            {currentStatus === 'cancelled'
              ? t('admin.review.cancelled_notice', 'This application has been cancelled and cannot be changed.')
              : t('admin.review.withdrawn_notice', 'This application was withdrawn by the parent and cannot be changed.')}
          </div>
        ) : (
          <>
            {/* Optional notes textarea — included in the review submission. */}
            <div className="mb-5">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
                {t('admin.review.notes_label')}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder={t('admin.review.notes_placeholder')}
                className="w-full rounded-lg px-3 py-2 text-sm resize-none border outline-none focus:ring-2 transition-all"
                style={{
                  background: 'var(--input)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              />
            </div>

            {/* ── State-aware action buttons ────────────────────────────────────────
                The review workflow has two deliberate stages:
                  1. PENDING (Unreviewed) — admin must consciously open the review.
                     Only "Start Review" is available. This prevents accidental decisions
                     on applications the admin hasn't fully read.
                  2. UNDER REVIEW — full decision set: Accept / Waitlist / Reject.
                     Admin has signalled intent to review; all outcome buttons are shown.
                This two-step gate replaces the old single-step model that showed all
                buttons for every non-terminal application. */}
            <div className="flex flex-col gap-2">

              {/* SUBMITTED (Unreviewed) — single action: open the review */}
              {currentStatus === 'submitted' && (
                <>
                  <div
                    className="rounded-lg px-3 py-2 text-xs"
                    style={{ background: 'rgba(107,114,128,0.08)', color: 'var(--muted-foreground)' }}
                  >
                    {t('admin.review.pending_notice')}
                  </div>
                  <Button
                    onClick={() => handleReview('under_review')}
                    loading={submitting === 'under_review'}
                    disabled={!!submitting}
                    variant="primary"
                    icon={<Clock className="h-4 w-4" />}
                  >
                    {t('admin.review.mark_under_review')}
                  </Button>
                </>
              )}

              {/* UNDER REVIEW — full decision set */}
              {currentStatus === 'under_review' && (
                <>
                  <Button
                    onClick={() => handleReview('approved')}
                    loading={submitting === 'approved'}
                    disabled={!!submitting}
                    variant="primary"
                    icon={<CheckCircle className="h-4 w-4" />}
                  >
                    {t('admin.review.accept')}
                  </Button>
                  <Button
                    onClick={() => handleReview('waitlisted')}
                    loading={submitting === 'waitlisted'}
                    disabled={!!submitting}
                    variant="secondary"
                    icon={<ListOrdered className="h-4 w-4" />}
                  >
                    {t('admin.review.waitlist')}
                  </Button>
                  <Button
                    onClick={() => handleReview('rejected')}
                    loading={submitting === 'rejected'}
                    disabled={!!submitting}
                    variant="ghost"
                    icon={<XCircle className="h-4 w-4" />}
                    style={{ color: 'var(--destructive)' }}
                  >
                    {t('admin.review.reject')}
                  </Button>
                </>
              )}

              {/* APPROVED — reversal or admin cancellation only */}
              {currentStatus === 'approved' && (
                <>
                  <div
                    className="rounded-lg px-3 py-2 text-xs mb-1"
                    style={{ background: 'rgba(22,163,74,0.08)', color: 'var(--ember-orange)' }}
                  >
                    {t('admin.review.approved_notice', 'This application is approved. Use the actions below to reverse the decision.')}
                  </div>
                  <Button
                    onClick={() => handleReview('rejected')}
                    loading={submitting === 'rejected'}
                    disabled={!!submitting}
                    variant="ghost"
                    icon={<XCircle className="h-4 w-4" />}
                    style={{ color: 'var(--destructive)' }}
                  >
                    {t('admin.review.reverse_decision', 'Reverse Decision')}
                  </Button>
                  <Button
                    onClick={() => handleReview('cancelled')}
                    loading={submitting === 'cancelled'}
                    disabled={!!submitting}
                    variant="ghost"
                    icon={<XCircle className="h-4 w-4" />}
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    {t('admin.review.cancel_enrollment', 'Cancel Enrollment')}
                  </Button>
                </>
              )}

              {/* REJECTED — re-approval only */}
              {currentStatus === 'rejected' && (
                <>
                  <div
                    className="rounded-lg px-3 py-2 text-xs mb-1"
                    style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--destructive)' }}
                  >
                    {t('admin.review.rejected_notice', 'This application was rejected. You may re-approve if circumstances have changed.')}
                  </div>
                  <Button
                    onClick={() => handleReview('approved')}
                    loading={submitting === 'approved'}
                    disabled={!!submitting}
                    variant="primary"
                    icon={<CheckCircle className="h-4 w-4" />}
                  >
                    {t('admin.review.re_approve', 'Re-approve Application')}
                  </Button>
                </>
              )}

              {/* WAITLISTED — promote, decline, or cancel */}
              {currentStatus === 'waitlisted' && (
                <>
                  <Button
                    onClick={() => handleReview('approved')}
                    loading={submitting === 'approved'}
                    disabled={!!submitting}
                    variant="primary"
                    icon={<CheckCircle className="h-4 w-4" />}
                  >
                    {t('admin.review.promote_from_waitlist', 'Approve (Promote)')}
                  </Button>
                  <Button
                    onClick={() => handleReview('rejected')}
                    loading={submitting === 'rejected'}
                    disabled={!!submitting}
                    variant="ghost"
                    icon={<XCircle className="h-4 w-4" />}
                    style={{ color: 'var(--destructive)' }}
                  >
                    {t('admin.review.reject')}
                  </Button>
                  <Button
                    onClick={() => handleReview('cancelled')}
                    loading={submitting === 'cancelled'}
                    disabled={!!submitting}
                    variant="ghost"
                    icon={<XCircle className="h-4 w-4" />}
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    {t('admin.review.cancel_enrollment', 'Cancel Enrollment')}
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function ApplicationReviewPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  // Build the correct back-link prefix depending on which portal is active.
  const applicationsPath = location.pathname.startsWith('/super-admin') ? '/super-admin/applications' : '/admin/applications';

  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const docInputRef = useRef<HTMLInputElement>(null);
  // Track which document is currently being verified (approved/rejected) to show per-doc loading state.
  const [verifyingDocId, setVerifyingDocId] = useState<number | null>(null);

  // Backend-computed required document types for this specific camper.
  // Null = not yet loaded (fallback to local conditions); populated after application loads.
  // This is the canonical list used in the Required Documents section — it comes from the same
  // SpecialNeedsRiskAssessmentService + DocumentEnforcementService that gates approval on the backend,
  // so the admin review display and backend enforcement logic are always in sync.
  const [backendRequiredDocs, setBackendRequiredDocs] = useState<ComplianceRequiredDoc[] | null>(null);

  // ── Fetch the application on mount, then load compliance data ──────────────
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(false);
    setBackendRequiredDocs(null);
    getApplication(Number(id))
      .then((app) => {
        setApplication(app);
        // After loading the application, fetch the backend-computed compliance status to
        // know exactly which documents are required for this camper's medical profile.
        // Non-critical: if this fails the page falls back to the local condition checks.
        if (app.camper?.id) {
          getCamperComplianceStatus(app.camper.id)
            .then((compliance) => setBackendRequiredDocs(compliance.required_documents))
            .catch(() => { /* non-critical; fallback to local conditions */ });
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  // ── Nested-model update helpers ────────────────────────────────────────────
  // After an admin edits a camper, emergency contact, or behavioral profile, we
  // patch the application state in-place rather than re-fetching the whole record.

  function handleCamperSaved(updatedCamper: Camper) {
    setApplication((prev) => prev
      ? { ...prev, camper: { ...prev.camper!, ...updatedCamper } }
      : prev
    );
  }

  function handleContactsChanged(contacts: EmergencyContact[]) {
    setApplication((prev) => prev
      ? { ...prev, camper: { ...prev.camper!, emergency_contacts: contacts } }
      : prev
    );
  }

  function handleProfileSaved(profile: BehavioralProfile) {
    setApplication((prev) => prev
      ? { ...prev, camper: { ...prev.camper!, behavioral_profile: profile } }
      : prev
    );
  }

  // ── Document upload helper ─────────────────────────────────────────────────
  // Files are attached to the Camper record so that DocumentEnforcementService can
  // find them during compliance checks. The show() endpoint merges camper-level
  // documents into application.documents, so we append to documents locally here.
  async function handleDocumentUpload(file: File) {
    if (!application || !application.camper) return;
    setUploadingDoc(true);
    try {
      const doc = await uploadDocumentOnBehalf(application.camper.id, file);
      setApplication((prev) => prev
        ? { ...prev, documents: [...(prev.documents ?? []), doc] }
        : prev
      );
      toast.success(`Document "${file.name}" uploaded successfully.`);
    } catch {
      toast.error('Document upload failed. Please try again.');
    } finally {
      setUploadingDoc(false);
      if (docInputRef.current) docInputRef.current.value = '';
    }
  }

  // ── Blob download helper ───────────────────────────────────────────────────
  // Downloads a document by creating a temporary anchor element and clicking it programmatically.
  function handleDownload(documentId: number, name: string) {
    axiosInstance
      .get(`/documents/${documentId}/download`, { responseType: 'blob' })
      .then((res) => {
        const url = URL.createObjectURL(res.data as Blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        // Clean up the temporary object URL to free memory.
        URL.revokeObjectURL(url);
      })
      .catch(() => toast.error(t('common.download_error')));
  }

  // ── Inline view helper ─────────────────────────────────────────────────────
  // Opens a document in a new browser tab without forcing a download.
  // Fetches the blob and creates an object URL so the browser renders it inline
  // regardless of the server's Content-Disposition header.
  function handleView(documentId: number) {
    axiosInstance
      .get(`/documents/${documentId}/download`, { responseType: 'blob' })
      .then((res) => {
        const blob = res.data as Blob;
        const url = URL.createObjectURL(blob);
        const tab = window.open(url, '_blank');
        // Revoke the object URL once the new tab has loaded to free memory.
        if (tab) {
          tab.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
        } else {
          // Pop-up blocked fallback: revoke after a short delay.
          setTimeout(() => URL.revokeObjectURL(url), 10000);
        }
      })
      .catch(() => toast.error(t('common.download_error')));
  }

  // ── Inline document verification ──────────────────────────────────────────
  // Allows admins to approve or reject a document directly on the review page
  // without navigating to the global Documents page. This is the core workflow
  // improvement: the review page becomes self-contained for required doc decisions.
  async function handleVerifyDocument(docId: number, status: 'approved' | 'rejected') {
    setVerifyingDocId(docId);
    try {
      const updated = await verifyDocument(docId, status);
      setApplication((prev) =>
        prev
          ? {
              ...prev,
              documents: prev.documents?.map((d) =>
                d.id === docId ? { ...d, verification_status: updated.verification_status } : d,
              ) ?? [],
            }
          : prev,
      );
      toast.success(status === 'approved' ? 'Document verified.' : 'Document rejected.');
    } catch {
      toast.error('Failed to update document status. Please try again.');
    } finally {
      setVerifyingDocId(null);
    }
  }

  // ── Loading / error states ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeletons.Block height={40} width={200} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Skeletons.Card />
            <Skeletons.Card />
          </div>
          <Skeletons.Card />
        </div>
      </div>
    );
  }

  if (error || !application) {
    return (
      <EmptyState
        title={t('admin.review.not_found')}
        description={t('admin.review.not_found_desc')}
        action={{ label: t('common.go_back'), onClick: () => navigate(-1) }}
      />
    );
  }

  // Convenient shortcuts to deeply nested objects.
  const camper = application.camper;
  const medical = camper?.medical_record;

  return (
    <div className="p-6 max-w-7xl">
      {/* Back link to the applications list. */}
      <Link
        to={applicationsPath}
        className="inline-flex items-center gap-2 text-sm mb-6 transition-colors"
        style={{ color: 'var(--muted-foreground)' }}
      >
        <ArrowLeft className="h-4 w-4" />
        {t('admin.review.back_to_applications')}
      </Link>

      {/* Incomplete-at-approval banner — shown whenever this application was force-approved with missing data. */}
      {application.is_incomplete_at_approval && (
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3 mb-4 border text-sm"
          style={{ background: 'rgba(234,88,12,0.08)', borderColor: 'rgba(234,88,12,0.30)', color: 'var(--ember-orange)' }}
        >
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>
            <strong>Approved with Missing Information</strong> — This application was approved
            by an admin despite missing fields, documents, or consents. Review the audit log for details.
          </span>
        </div>
      )}

      {/* Reapplication banner — shown when this application replaced a prior one. */}
      {application.reapplied_from_id != null && (
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3 mb-4 border text-sm"
          style={{ background: 'rgba(99,102,241,0.08)', borderColor: 'rgba(99,102,241,0.25)', color: 'rgb(99,102,241)' }}
        >
          <span className="text-base">↩</span>
          <span>
            {t('admin.review.reapplication_banner')}{' '}
            {/* Link uses the DB id for routing (required); display text avoids exposing raw ids. */}
            <Link
              to={`${applicationsPath}/${application.reapplied_from_id}`}
              className="underline underline-offset-2 hover:opacity-80"
            >
              {t('admin.review.view_original')}
            </Link>
          </span>
        </div>
      )}

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="mb-6">
        {/* Name + status row */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="font-headline text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
              {camper?.full_name ?? t('admin.review.unknown_camper')}
            </h1>
            {application.session && (
              <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                {application.session.name}
                {application.session.camp && <> &middot; {application.session.camp.name}</>}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <StatusBadge status={application.status} />
            <Button
              variant="secondary"
              onClick={() => navigate(
                location.pathname.startsWith('/super-admin')
                  ? ROUTES.SUPER_ADMIN_APPLICATION_EDIT(application.id)
                  : ROUTES.ADMIN_APPLICATION_EDIT(application.id)
              )}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            >
              <Pencil size={14} />
              {t('admin.review.edit_application')}
            </Button>
          </div>
        </div>

        {/* ── Stat cards row — three at-a-glance metrics ────────────────────
            App Number  |  Submitted  |  Queue Position
            These replace the previous bare "Application #62" sub-label. */}
        <div className="grid grid-cols-3 gap-3">
          {/* App Number card */}
          <div
            className="rounded-xl px-4 py-3 border"
            style={{ background: 'var(--glass-medium)', borderColor: 'var(--border)' }}
          >
            <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--muted-foreground)' }}>
              {t('admin.review.stat_app_number')}
            </p>
            <p className="text-sm font-mono font-semibold" style={{ color: 'var(--foreground)' }}>
              {application.application_number ?? `#${application.id}`}
            </p>
            {application.attended_before && (
              <p className="text-xs mt-1" style={{ color: 'var(--ember-orange)' }}>
                {t('admin.review.returning_camper')}
              </p>
            )}
          </div>

          {/* Submitted card */}
          <div
            className="rounded-xl px-4 py-3 border"
            style={{ background: 'var(--glass-medium)', borderColor: 'var(--border)' }}
          >
            <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--muted-foreground)' }}>
              {t('admin.review.stat_submitted')}
            </p>
            {application.submitted_at ? (
              <>
                <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                  {formatDistanceToNow(new Date(application.submitted_at), { addSuffix: true })}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                  {format(new Date(application.submitted_at), 'MMM d, yyyy')}
                </p>
              </>
            ) : (
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {t('common.not_submitted')}
              </p>
            )}
          </div>

          {/* Queue Position card — only shown for active (non-final) applications */}
          <div
            className="rounded-xl px-4 py-3 border"
            style={{ background: 'var(--glass-medium)', borderColor: 'var(--border)' }}
          >
            <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--muted-foreground)' }}>
              {t('admin.review.stat_queue_position')}
            </p>
            {application.queue_position ? (
              <>
                <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                  {t('admin.review.queue_position_value', {
                    position: application.queue_position.position,
                    total:    application.queue_position.total,
                  })}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                  {t('admin.review.queue_position_hint')}
                </p>
              </>
            ) : (
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {/* Approved/rejected/etc. applications are no longer in the review queue */}
                {t('admin.review.queue_position_resolved')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Two-column layout: detail sections on left, review panel on right. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — all the application details */}
        <div className="lg:col-span-2 space-y-5">
          {/* Camper information — inline editable */}
          {camper && (
            <CamperEditSection
              camper={camper}
              appStatus={application.status}
              session={application.session}
              sessionSecond={application.second_session}
              firstApplication={application.first_application}
              attendedBefore={application.attended_before}
              onCamperSaved={handleCamperSaved}
            />
          )}

          {/* Parent / Guardian info — only shown when the user relation is loaded. */}
          {camper?.user && (
            <SectionCard title="Parent / Guardian" icon={<Users className="h-4 w-4" />}>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  ['Name', camper.user.name],
                  ['Email', camper.user.email],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
                    <p style={{ color: 'var(--foreground)' }}>{value ?? t('common.not_provided')}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Medical summary — only shown when a medical_record relation is present. */}
          {medical && (
            <SectionCard title={t('admin.review.medical_summary')} icon={<Heart className="h-4 w-4" />}>
                {/* Diagnoses list */}
                {medical.diagnoses && medical.diagnoses.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-medium mb-2 flex items-center gap-1.5" style={{ color: 'var(--muted-foreground)' }}>
                      <Stethoscope className="h-3 w-3" /> Diagnoses
                    </p>
                    <div className="space-y-1">
                      {medical.diagnoses.map((d) => (
                        <p key={d.id} className="text-sm" style={{ color: 'var(--foreground)' }}>
                          {d.name}{d.icd_code ? ` (${d.icd_code})` : ''}
                          {d.notes ? <span style={{ color: 'var(--muted-foreground)' }}> — {d.notes}</span> : null}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Allergies — life-threatening ones get a red tint to stand out. */}
                {medical.allergies && medical.allergies.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-medium mb-2 flex items-center gap-1.5" style={{ color: 'var(--muted-foreground)' }}>
                      <AlertTriangle className="h-3 w-3" /> {t('admin.review.allergies')}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {medical.allergies.map((a) => (
                        <span
                          key={a.id}
                          className="text-xs px-2.5 py-1 rounded-full border"
                          style={{
                            background: a.severity.toLowerCase().includes('life') ? 'rgba(220,38,38,0.15)' : 'rgba(22,163,74,0.1)',
                            borderColor: a.severity.toLowerCase().includes('life') ? 'rgba(220,38,38,0.4)' : 'rgba(22,163,74,0.3)',
                            color: a.severity.toLowerCase().includes('life') ? 'var(--destructive)' : 'var(--warm-amber)',
                          }}
                        >
                          {a.allergen} — {a.severity}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Medications */}
                {medical.medications && medical.medications.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-medium mb-2 flex items-center gap-1.5" style={{ color: 'var(--muted-foreground)' }}>
                      <Pill className="h-3 w-3" /> {t('admin.review.medications')}
                    </p>
                    <div className="space-y-1.5">
                      {medical.medications.map((m) => (
                        <p key={m.id} className="text-sm" style={{ color: 'var(--foreground)' }}>
                          {m.name} — {m.dosage}, {m.frequency}
                          {m.route ? ` (${m.route})` : ''}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Special needs and dietary restrictions — shown side by side when both present. */}
                {(medical.special_needs || medical.dietary_restrictions) && (
                  <div className="grid grid-cols-1 gap-3 mb-4">
                    {medical.special_needs && (
                      <div>
                        <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>Special Needs</p>
                        <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--foreground)' }}>{medical.special_needs}</p>
                      </div>
                    )}
                    {medical.dietary_restrictions && (
                      <div>
                        <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>Dietary Restrictions</p>
                        <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--foreground)' }}>{medical.dietary_restrictions}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Seizure history — highlighted in red to signal critical safety info. */}
                {medical.has_seizures && (
                  <div
                    className="rounded-lg p-3 border mb-4"
                    style={{ background: 'rgba(220,38,38,0.06)', borderColor: 'rgba(220,38,38,0.2)' }}
                  >
                    <p className="text-xs font-semibold mb-1" style={{ color: 'var(--destructive)' }}>Seizure History</p>
                    {medical.last_seizure_date && (
                      <p className="text-xs mb-0.5" style={{ color: 'var(--foreground)' }}>
                        Last seizure: {format(new Date(medical.last_seizure_date), 'MMM d, yyyy')}
                      </p>
                    )}
                    {medical.seizure_description && (
                      <p className="text-xs whitespace-pre-wrap" style={{ color: 'var(--foreground)' }}>{medical.seizure_description}</p>
                    )}
                    {medical.has_neurostimulator && (
                      <p className="text-xs mt-1 font-medium" style={{ color: 'var(--destructive)' }}>Has neurostimulator</p>
                    )}
                  </div>
                )}

                {/* Physician & insurance — filter out undefined values before mapping. */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['Physician', medical.physician_name],
                    ['Physician Phone', medical.physician_phone],
                    ['Physician Address', medical.physician_address],
                    ['Insurance Provider', medical.insurance_provider],
                    ['Policy Number', medical.insurance_policy_number],
                    ['Insurance Group', medical.insurance_group],
                    // date_of_medical_exam drives the 12-month Form 4523 validity window
                    ['Medical Exam Date', medical.date_of_medical_exam
                      ? format(new Date(medical.date_of_medical_exam), 'MMM d, yyyy')
                      : undefined],
                  ].filter(([, v]) => v).map(([label, value]) => (
                    <div key={label as string}>
                      <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
                      <p className="text-sm" style={{ color: 'var(--foreground)' }}>{value}</p>
                    </div>
                  ))}
                </div>

                {medical.notes && (
                  <div className="mt-3">
                    <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>Medical Notes</p>
                    <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--foreground)' }}>{medical.notes}</p>
                  </div>
                )}

                {/* Extended health status fields */}
                {(() => {
                  const healthFlags: [string, boolean | undefined][] = [
                    ['Immunizations Current',   medical.immunizations_current],
                    ['Tubes in Ears',           medical.tubes_in_ears],
                    ['Contagious Illness',       medical.has_contagious_illness],
                    ['Recent Illness',          medical.has_recent_illness],
                  ];
                  const presentFlags = healthFlags.filter(([, v]) => v === true);
                  const absentFlags  = healthFlags.filter(([, v]) => v === false);
                  if (presentFlags.length === 0 && absentFlags.length === 0) return null;
                  return (
                    <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                      <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted-foreground)' }}>Health Status</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {healthFlags.filter(([, v]) => v != null).map(([label, val]) => (
                          <div key={label} className="flex items-center gap-1.5">
                            <span
                              className="h-2 w-2 rounded-full flex-shrink-0"
                              style={{ background: val ? '#16a34a' : '#dc2626' }}
                            />
                            <span style={{ color: 'var(--foreground)' }}>{label}: <strong>{val ? 'Yes' : 'No'}</strong></span>
                          </div>
                        ))}
                      </div>
                      {medical.contagious_illness_description && (
                        <p className="text-xs mt-1.5" style={{ color: 'var(--foreground)' }}>
                          Contagious illness: {medical.contagious_illness_description}
                        </p>
                      )}
                      {medical.recent_illness_description && (
                        <p className="text-xs mt-1" style={{ color: 'var(--foreground)' }}>
                          Recent illness: {medical.recent_illness_description}
                        </p>
                      )}
                      {medical.mobility_notes && (
                        <div className="mt-2">
                          <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>Mobility Notes</p>
                          <p className="text-xs whitespace-pre-wrap" style={{ color: 'var(--foreground)' }}>{medical.mobility_notes}</p>
                        </div>
                      )}
                      {medical.tetanus_date && (
                        <p className="text-xs mt-1.5" style={{ color: 'var(--muted-foreground)' }}>
                          Tetanus date: {format(new Date(medical.tetanus_date), 'MMM d, yyyy')}
                        </p>
                      )}
                    </div>
                  );
                })()}
            </SectionCard>
          )}

          {/* Emergency contacts — inline editable */}
          {camper && (
            <EmergencyContactsSection
              contacts={camper.emergency_contacts ?? []}
              camperId={camper.id}
              appStatus={application.status}
              onContactsChanged={handleContactsChanged}
            />
          )}

          {/* Behavioral profile — inline editable */}
          {camper?.behavioral_profile && (
            <BehavioralProfileEditSection
              profile={camper.behavioral_profile}
              appStatus={application.status}
              onProfileSaved={handleProfileSaved}
            />
          )}

          {/* Narrative responses — inline editable (admin notes + 8 narrative fields) */}
          <NarrativesSection
            application={application}
            onSaved={setApplication}
          />

          {/* Feeding plan */}
          {camper?.feeding_plan && (
            <SectionCard title="Diet & Feeding" icon={<Utensils className="h-4 w-4" />}>
                <div className="space-y-3 text-sm">
                  {/* G-tube alert — shown prominently if present */}
                  {camper.feeding_plan.g_tube && (
                    <div
                      className="rounded-lg px-3 py-2 border"
                      style={{ background: 'rgba(234,88,12,0.07)', borderColor: 'rgba(234,88,12,0.25)' }}
                    >
                      <p className="text-xs font-semibold" style={{ color: 'var(--ember-orange)' }}>G-Tube / Enteral Feeding</p>
                      <div className="grid grid-cols-2 gap-2 mt-1.5 text-xs">
                        {[
                          ['Formula', camper.feeding_plan.formula],
                          ['Amount per Feeding', camper.feeding_plan.amount_per_feeding],
                          ['Feedings per Day', camper.feeding_plan.feedings_per_day?.toString()],
                          ['Bolus Only', camper.feeding_plan.bolus_only ? 'Yes' : undefined],
                        ].filter(([, v]) => v).map(([label, value]) => (
                          <div key={label as string}>
                            <span style={{ color: 'var(--muted-foreground)' }}>{label}: </span>
                            <span style={{ color: 'var(--foreground)' }}>{value}</span>
                          </div>
                        ))}
                      </div>
                      {camper.feeding_plan.feeding_times && camper.feeding_plan.feeding_times.length > 0 && (
                        <p className="text-xs mt-1">
                          <span style={{ color: 'var(--muted-foreground)' }}>Feeding times: </span>
                          <span style={{ color: 'var(--foreground)' }}>{camper.feeding_plan.feeding_times.join(', ')}</span>
                        </p>
                      )}
                    </div>
                  )}

                  {/* Diet and texture */}
                  {(camper.feeding_plan.special_diet || camper.feeding_plan.texture_modified || camper.feeding_plan.fluid_restriction) && (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {camper.feeding_plan.special_diet && (
                        <div>
                          <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>Special Diet</p>
                          <p style={{ color: 'var(--foreground)' }}>{camper.feeding_plan.diet_description ?? 'Yes'}</p>
                        </div>
                      )}
                      {camper.feeding_plan.texture_modified && (
                        <div>
                          <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>Texture Modified</p>
                          <p style={{ color: 'var(--foreground)' }}>{camper.feeding_plan.texture_level ?? 'Yes'}</p>
                        </div>
                      )}
                      {camper.feeding_plan.fluid_restriction && (
                        <div>
                          <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>Fluid Restriction</p>
                          <p style={{ color: 'var(--foreground)' }}>{camper.feeding_plan.fluid_details ?? 'Yes'}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Text fields */}
                  {[
                    ['Method', camper.feeding_plan.method],
                    ['Restrictions', camper.feeding_plan.restrictions],
                    ['Notes', camper.feeding_plan.notes],
                  ].filter(([, v]) => v).map(([label, value]) => (
                    <div key={label as string}>
                      <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
                      <p className="whitespace-pre-wrap" style={{ color: 'var(--foreground)' }}>{value}</p>
                    </div>
                  ))}
                </div>
            </SectionCard>
          )}

          {/* Personal care plan — fully read-only; not inline-editable from this page */}
          {camper?.personal_care_plan && (
            <SectionCard title="Personal Care" icon={<Heart className="h-4 w-4" />}>
              <div className="space-y-3 text-sm">
                {/* Care level grid */}
                {(() => {
                  const levels: [string, string | undefined][] = [
                    ['Bathing',      camper.personal_care_plan.bathing_level],
                    ['Toileting',    camper.personal_care_plan.toileting_level],
                    ['Dressing',     camper.personal_care_plan.dressing_level],
                    ['Oral Hygiene', camper.personal_care_plan.oral_hygiene_level],
                  ].filter(([, v]) => v) as [string, string][];
                  if (levels.length === 0) return null;
                  return (
                    <div>
                      <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted-foreground)' }}>Assistance Levels</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {levels.map(([label, value]) => (
                          <div key={label}>
                            <span style={{ color: 'var(--muted-foreground)' }}>{label}: </span>
                            <span className="font-medium" style={{ color: 'var(--foreground)' }}>{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Care notes */}
                {[
                  ['Bathing Notes',      camper.personal_care_plan.bathing_notes],
                  ['Toileting Notes',    camper.personal_care_plan.toileting_notes],
                  ['Dressing Notes',     camper.personal_care_plan.dressing_notes],
                  ['Oral Hygiene Notes', camper.personal_care_plan.oral_hygiene_notes],
                  ['Positioning Notes',  camper.personal_care_plan.positioning_notes],
                  ['Sleep Notes',        camper.personal_care_plan.sleep_notes],
                  ['Bowel / Bladder',    camper.personal_care_plan.bowel_control_notes],
                ].filter(([, v]) => v).map(([label, value]) => (
                  <div key={label as string}>
                    <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
                    <p className="whitespace-pre-wrap" style={{ color: 'var(--foreground)' }}>{value}</p>
                  </div>
                ))}

                {/* Flags */}
                {(() => {
                  const flags: [string, boolean | undefined][] = [
                    ['Nighttime Toileting',   camper.personal_care_plan.nighttime_toileting],
                    ['Irregular Bowel',       camper.personal_care_plan.irregular_bowel],
                    ['Urinary Catheter',      camper.personal_care_plan.urinary_catheter],
                    ['Menstruation Support',  camper.personal_care_plan.menstruation_support],
                    ['Falling Asleep Issues', camper.personal_care_plan.falling_asleep_issues],
                    ['Sleep Walking',         camper.personal_care_plan.sleep_walking],
                    ['Night Wandering',       camper.personal_care_plan.night_wandering],
                  ].filter(([, v]) => v === true) as [string, boolean][];
                  if (flags.length === 0) return null;
                  return (
                    <div>
                      <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--muted-foreground)' }}>Care Flags</p>
                      <div className="flex flex-wrap gap-1.5">
                        {flags.map(([label]) => (
                          <span
                            key={label}
                            className="text-xs px-2 py-0.5 rounded-full border"
                            style={{ background: 'rgba(22,163,74,0.08)', borderColor: 'rgba(22,163,74,0.25)', color: 'var(--warm-amber)' }}
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                      {camper.personal_care_plan.nighttime_notes && (
                        <p className="text-xs mt-1.5" style={{ color: 'var(--foreground)' }}>
                          Nighttime notes: {camper.personal_care_plan.nighttime_notes}
                        </p>
                      )}
                      {camper.personal_care_plan.irregular_bowel_notes && (
                        <p className="text-xs mt-1" style={{ color: 'var(--foreground)' }}>
                          Bowel notes: {camper.personal_care_plan.irregular_bowel_notes}
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            </SectionCard>
          )}

          {/* Assistive devices */}
          {camper?.assistive_devices && camper.assistive_devices.length > 0 && (
            <SectionCard title="Equipment & Mobility" icon={<Wrench className="h-4 w-4" />}>
                <div className="space-y-2">
                  {camper.assistive_devices.map((d) => (
                    <div key={d.id} className="text-sm">
                      <span className="font-medium" style={{ color: 'var(--foreground)' }}>{d.device_type}</span>
                      {d.notes && (
                        <span style={{ color: 'var(--muted-foreground)' }}> — {d.notes}</span>
                      )}
                    </div>
                  ))}
                </div>
            </SectionCard>
          )}

          {/* Activity permissions — circles colored by permission level (green/amber/red). */}
          {camper?.activity_permissions && camper.activity_permissions.length > 0 && (
            <SectionCard title="Activities & Permissions" icon={<Activity className="h-4 w-4" />}>
                <div className="space-y-2">
                  {camper.activity_permissions.map((p) => (
                    <div key={p.id} className="flex items-start gap-2 text-sm">
                      <span
                        className="mt-0.5 w-4 h-4 flex-shrink-0 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                        style={{ background: p.permission_level === 'yes' ? '#16a34a' : p.permission_level === 'restricted' ? '#ca8a04' : 'var(--destructive)' }}
                      >
                        {p.permission_level === 'yes' ? '✓' : p.permission_level === 'restricted' ? '~' : '✗'}
                      </span>
                      <span style={{ color: 'var(--foreground)' }}>
                        {p.activity_name}
                        {p.restriction_notes && <span style={{ color: 'var(--muted-foreground)' }}> — {p.restriction_notes}</span>}
                      </span>
                    </div>
                  ))}
                </div>
            </SectionCard>
          )}

          {/*
           * Required Documents — the application review control center for document decisions.
           *
           * Each document shows one of five distinct states (never ambiguous):
           *   • Not uploaded        — file was never submitted
           *   • Uploaded — awaiting review — file received, verification pending (verification_status=pending)
           *   • Verified            — admin confirmed the document is valid (verification_status=approved)
           *   • Rejected            — admin rejected; applicant must re-submit (verification_status=rejected)
           *   • Expired             — document has a past expiration_date regardless of verification state
           *
           * Inline Verify / Reject buttons allow the reviewer to handle required documents
           * entirely within this page — no detour to the global Documents page required.
           *
           * Conditional document rows appear only when the camper's data triggers the requirement,
           * matching exactly the conditions checked in applicant form Section 9.
           */}
          <SectionCard
            title="Required Documents"
            icon={<CheckCircle className="h-4 w-4" />}
          >
            {(() => {
              // Resolve a document's display state from persisted data, not frontend guesses.
              // When multiple documents of the same type exist, prefer: approved > pending > rejected,
              // so a reviewer sees the best available state rather than whichever arrived first.
              // Accepts multiple types so the medical exam row can match both 'official_medical_form'
              // (current canonical key) and 'physical_examination' (legacy key, pre-000005 migration).
              function docState(...docTypes: string[]) {
                const candidates = (application?.documents ?? []).filter((d) => d.document_type != null && docTypes.includes(d.document_type));
                if (candidates.length === 0) {
                  return { icon: 'missing' as const, color: '#ca8a04', label: 'Not uploaded', doc: null };
                }
                // Pick the best candidate: approved first, then pending, then rejected
                const best =
                  candidates.find((d) => d.verification_status === 'approved') ??
                  candidates.find((d) => !d.verification_status || d.verification_status === 'pending') ??
                  candidates[0];
                const doc = best;
                const isExpired = doc.expiration_date && new Date(doc.expiration_date) < new Date();
                if (isExpired) {
                  return { icon: 'expired' as const, color: '#dc2626', label: 'Expired — re-submission required', doc };
                }
                switch (doc.verification_status) {
                  case 'approved':
                    return { icon: 'verified' as const, color: '#16a34a', label: 'Verified', doc };
                  case 'rejected':
                    return { icon: 'rejected' as const, color: '#dc2626', label: 'Rejected — replacement required', doc };
                  default:
                    // 'pending' or undefined (legacy documents without a status value default to pending)
                    return { icon: 'pending' as const, color: '#ca8a04', label: 'Uploaded — awaiting review', doc };
                }
              }

              // Required document list — built from the backend compliance API (backendRequiredDocs) when
              // available, falling back to a locally-computed list while the async call is in flight or if
              // it fails.  Using the backend list ensures the admin review display and the backend approval
              // enforcement gate always agree on which documents are required for this specific camper.
              //
              // 'official_medical_form' is intentionally excluded from allDocs because it is rendered as
              // a dedicated hardcoded row (with inline Verify/Reject) in the section above this map.

              type DocEntry = { type: string; label: string };

              let allDocs: DocEntry[];

              // Document types rendered as dedicated hardcoded rows above this map.
              // Filtering them here prevents duplicate rows in the allDocs section.
              // 'physical_examination' is the legacy key that was in required_document_rules
              // before migration 000005 renamed the rule to 'official_medical_form'.
              // 'medical_exam' is a seeder-era type present in databases seeded before
              // the DocumentSeeder was corrected — included so those records don't produce
              // phantom required-doc rows in the generic allDocs section.
              // All three must be excluded here; the dedicated row handles display for all.
              const DEDICATED_ROW_TYPES = new Set(['official_medical_form', 'physical_examination', 'medical_exam']);

              if (backendRequiredDocs !== null) {
                // Backend-authoritative path: use the full backend-computed list.
                allDocs = backendRequiredDocs
                  .filter((d) => !DEDICATED_ROW_TYPES.has(d.document_type))
                  .map((d) => ({
                    type: d.document_type,
                    label: getDocumentLabel(d.document_type, 'admin'),
                  }));
              } else {
                // Fallback path (backend call still in-flight or failed): derive from loaded camper data.
                // This mirrors the RequiredDocumentRuleSeeder conditions and serves as a degraded-mode display.
                const universalDocs: DocEntry[] = UNIVERSAL_REQUIRED_DOC_TYPES.map((type) => ({
                  type,
                  label: getDocumentLabel(type, 'admin'),
                }));

                const conditionalDocs: DocEntry[] = [];

                if (medical?.has_seizures) {
                  conditionalDocs.push({ type: 'seizure_action_plan', label: getDocumentLabel('seizure_action_plan', 'admin') });
                  conditionalDocs.push({ type: 'seizure_medication_authorization', label: getDocumentLabel('seizure_medication_authorization', 'admin') });
                }
                if (camper?.feeding_plan?.g_tube) {
                  conditionalDocs.push({ type: 'feeding_action_plan', label: getDocumentLabel('feeding_action_plan', 'admin') });
                  conditionalDocs.push({ type: 'feeding_equipment_list', label: getDocumentLabel('feeding_equipment_list', 'admin') });
                }
                if (camper?.behavioral_profile?.one_to_one_supervision) {
                  conditionalDocs.push({ type: 'behavioral_support_plan', label: getDocumentLabel('behavioral_support_plan', 'admin') });
                  conditionalDocs.push({ type: 'staffing_accommodation_request', label: getDocumentLabel('staffing_accommodation_request', 'admin') });
                }
                if (camper?.behavioral_profile?.wandering_risk) {
                  conditionalDocs.push({ type: 'elopement_prevention_plan', label: getDocumentLabel('elopement_prevention_plan', 'admin') });
                }
                if (camper?.behavioral_profile?.aggression) {
                  conditionalDocs.push({ type: 'crisis_intervention_plan', label: getDocumentLabel('crisis_intervention_plan', 'admin') });
                }
                if (camper?.assistive_devices?.some((d) => d.device_type?.toLowerCase().includes('cpap'))) {
                  conditionalDocs.push({ type: 'cpap_waiver', label: getDocumentLabel('cpap_waiver', 'admin') });
                }
                if (camper?.assistive_devices?.some((d) => d.device_type?.toLowerCase().includes('neurostimulator'))) {
                  conditionalDocs.push({ type: 'device_management_plan', label: getDocumentLabel('device_management_plan', 'admin') });
                }

                allDocs = [...universalDocs, ...conditionalDocs];
              }

              return (
                <div className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
                  {/* Application form row */}
                  <div className="flex items-center justify-between gap-4 py-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {application.submitted_at && !application.is_draft ? (
                        <CheckCircle className="h-4 w-4 flex-shrink-0" style={{ color: '#16a34a' }} />
                      ) : (
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" style={{ color: '#ca8a04' }} />
                      )}
                      <div className="min-w-0">
                        <span className="text-sm" style={{ color: 'var(--foreground)' }}>Application Form</span>
                      </div>
                    </div>
                    <span
                      className="text-xs font-medium"
                      style={{ color: application.submitted_at && !application.is_draft ? '#16a34a' : '#ca8a04' }}
                    >
                      {application.submitted_at && !application.is_draft ? 'Submitted' : 'Not submitted'}
                    </span>
                  </div>

                  {/* Medical Examination Form row — always required; physician-completed Form 4523-ENG-DPH.
                      Shown here (not via allDocs map) because it is an uploaded file that needs verify/reject,
                      unlike the application form row above which reflects digital-form completion status.
                      'official_medical_form' (current), 'physical_examination' (legacy pre-000005),
                      and 'medical_exam' (seeder-era key corrected by 2026_04_11_000001 migration)
                      are all searched so historical data renders correctly in all database states. */}
                  {(() => {
                    const state = docState('official_medical_form', 'physical_examination', 'medical_exam');
                    const isVerifying = verifyingDocId === state.doc?.id;
                    return (
                      <div className="flex items-start justify-between gap-4 py-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {state.icon === 'verified' ? (
                            <CheckCircle className="h-4 w-4 flex-shrink-0" style={{ color: state.color }} />
                          ) : state.icon === 'rejected' || state.icon === 'expired' ? (
                            <XCircle className="h-4 w-4 flex-shrink-0" style={{ color: state.color }} />
                          ) : state.icon === 'pending' ? (
                            <Clock className="h-4 w-4 flex-shrink-0" style={{ color: state.color }} />
                          ) : (
                            <AlertTriangle className="h-4 w-4 flex-shrink-0" style={{ color: state.color }} />
                          )}
                          <div className="min-w-0">
                            <span className="text-sm" style={{ color: 'var(--foreground)' }}>
                              {getDocumentLabel('official_medical_form', 'admin')}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                          <span className="text-xs font-medium" style={{ color: state.color }}>{state.label}</span>
                          {state.doc && (
                            <>
                              <button
                                onClick={() => handleView(state.doc!.id)}
                                className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                                style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                              >
                                <Eye className="h-3 w-3" />
                                View
                              </button>
                              <button
                                onClick={() => handleDownload(state.doc!.id, state.doc!.name ?? state.doc!.file_name)}
                                className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                                style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                              >
                                <Download className="h-3 w-3" />
                                Download
                              </button>
                              {state.icon === 'pending' && (
                                <>
                                  <button
                                    disabled={isVerifying}
                                    onClick={() => handleVerifyDocument(state.doc!.id, 'approved')}
                                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors"
                                    style={{ borderColor: 'rgba(22,163,74,0.4)', color: '#16a34a', background: 'rgba(22,163,74,0.07)', opacity: isVerifying ? 0.6 : 1 }}
                                  >
                                    <CheckCircle className="h-3 w-3" />
                                    {isVerifying ? '…' : 'Verify'}
                                  </button>
                                  <button
                                    disabled={isVerifying}
                                    onClick={() => handleVerifyDocument(state.doc!.id, 'rejected')}
                                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors"
                                    style={{ borderColor: 'rgba(220,38,38,0.35)', color: '#dc2626', background: 'rgba(220,38,38,0.07)', opacity: isVerifying ? 0.6 : 1 }}
                                  >
                                    <XCircle className="h-3 w-3" />
                                    Reject
                                  </button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Document rows — one per required type, with deterministic state and inline verify/reject */}
                  {allDocs.map(({ type, label }) => {
                    const state = docState(type);
                    const isVerifying = verifyingDocId === state.doc?.id;
                    return (
                      <div key={type} className="flex items-start justify-between gap-4 py-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {state.icon === 'verified' ? (
                            <CheckCircle className="h-4 w-4 flex-shrink-0" style={{ color: state.color }} />
                          ) : state.icon === 'rejected' || state.icon === 'expired' ? (
                            <XCircle className="h-4 w-4 flex-shrink-0" style={{ color: state.color }} />
                          ) : state.icon === 'pending' ? (
                            <Clock className="h-4 w-4 flex-shrink-0" style={{ color: state.color }} />
                          ) : (
                            <AlertTriangle className="h-4 w-4 flex-shrink-0" style={{ color: state.color }} />
                          )}
                          <div className="min-w-0">
                            <span className="text-sm" style={{ color: 'var(--foreground)' }}>{label}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                          <span className="text-xs font-medium" style={{ color: state.color }}>{state.label}</span>
                          {state.doc && (
                            <>
                              <button
                                onClick={() => handleView(state.doc!.id)}
                                className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                                style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                              >
                                <Eye className="h-3 w-3" />
                                View
                              </button>
                              <button
                                onClick={() => handleDownload(state.doc!.id, state.doc!.name ?? state.doc!.file_name)}
                                className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                                style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                              >
                                <Download className="h-3 w-3" />
                                Download
                              </button>
                              {/* Inline verify/reject — only shown for documents awaiting review.
                                  This is the core workflow improvement: the reviewer never needs to leave
                                  this page to complete required document verification. */}
                              {state.icon === 'pending' && (
                                <>
                                  <button
                                    disabled={isVerifying}
                                    onClick={() => handleVerifyDocument(state.doc!.id, 'approved')}
                                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors"
                                    style={{
                                      borderColor: 'rgba(22,163,74,0.4)',
                                      color: '#16a34a',
                                      background: 'rgba(22,163,74,0.07)',
                                      opacity: isVerifying ? 0.6 : 1,
                                    }}
                                  >
                                    <CheckCircle className="h-3 w-3" />
                                    {isVerifying ? '…' : 'Verify'}
                                  </button>
                                  <button
                                    disabled={isVerifying}
                                    onClick={() => handleVerifyDocument(state.doc!.id, 'rejected')}
                                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors"
                                    style={{
                                      borderColor: 'rgba(220,38,38,0.35)',
                                      color: '#dc2626',
                                      background: 'rgba(220,38,38,0.07)',
                                      opacity: isVerifying ? 0.6 : 1,
                                    }}
                                  >
                                    <XCircle className="h-3 w-3" />
                                    Reject
                                  </button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </SectionCard>

          {/* Guardian consents — compliance checklist showing all 7 required consent types */}
          <SectionCard title="Consents & Signatures" icon={<ShieldCheck className="h-4 w-4" />}>
            {(() => {
              const CONSENT_LABELS: Record<string, string> = {
                general:       'General Camp Participation',
                photos:        'Photo & Media Release',
                liability:     'Liability Waiver',
                activity:      'Permission to Participate in Activities',
                authorization: 'Medical Treatment Authorization',
                medication:    'Medication Administration Consent',
                hipaa:         'HIPAA Privacy Acknowledgment',
              };
              const ALL_TYPES = Object.keys(CONSENT_LABELS);
              const stored: Set<string> = new Set((application.consents ?? []).map((c) => c.consent_type));
              const signedBy = application.consents?.[0]?.guardian_name;
              const signedAt = application.consents?.[0]?.signed_at;
              const allSigned = ALL_TYPES.every((t) => stored.has(t));

              return (
                <div className="space-y-2">
                  {application.consents && application.consents.length > 0 ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {ALL_TYPES.map((type) => (
                          <div
                            key={type}
                            className="flex items-center gap-2 text-sm p-2 rounded-lg"
                            style={{ background: stored.has(type) ? 'rgba(22,163,74,0.07)' : 'rgba(239,68,68,0.07)' }}
                          >
                            {stored.has(type)
                              ? <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#16a34a' }} />
                              : <XCircle className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#dc2626' }} />}
                            <span style={{ color: 'var(--foreground)' }}>{CONSENT_LABELS[type]}</span>
                          </div>
                        ))}
                      </div>
                      <div className="pt-2 border-t text-xs space-y-0.5" style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
                        {signedBy && <p>Signed by: <span style={{ color: 'var(--foreground)' }}>{signedBy}</span></p>}
                        {signedAt && <p>Date: <span style={{ color: 'var(--foreground)' }}>{format(new Date(signedAt), 'MMM d, yyyy')}</span></p>}
                        <p className="font-medium" style={{ color: allSigned ? '#16a34a' : '#dc2626' }}>
                          {allSigned ? '✓ All 7 consents collected' : `⚠ ${ALL_TYPES.length - stored.size} consent(s) missing`}
                        </p>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                      No consent records found for this application.
                    </p>
                  )}
                </div>
              );
            })()}
          </SectionCard>

          {/* Supplementary Documents — additional files uploaded beyond the required checklist.
               Required document types (official_medical_form, immunization_record, insurance_card,
               and any condition-specific docs) are already shown in the Required Documents section
               above and are excluded here to prevent duplication and contradictory empty states. */}
          <SectionCard
            title="Supplementary Documents"
            icon={<FileText className="h-4 w-4" />}
            headerAction={
              <button
                type="button"
                onClick={() => docInputRef.current?.click()}
                disabled={uploadingDoc}
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
              >
                <Upload style={{ width: 11, height: 11 }} />
                {uploadingDoc ? 'Uploading…' : 'Upload'}
              </button>
            }
          >
            {/* Hidden file input for document upload */}
            <input
              ref={docInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleDocumentUpload(file);
              }}
            />

            {(() => {
              const supplementaryDocs = (application.documents ?? []).filter(
                (d) => !isRequiredDocumentType(d.document_type),
              );
              if (supplementaryDocs.length === 0) {
                return (
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    No supplementary documents attached.
                  </p>
                );
              }
              return (
              <div className="space-y-2">
                {supplementaryDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                    style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--ember-orange)' }} />
                      <div className="min-w-0">
                        <p className="text-sm truncate" style={{ color: 'var(--foreground)' }}>{doc.name ?? doc.file_name}</p>
                        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          {(() => {
                            const bytes = doc.file_size ?? doc.size;
                            return bytes != null ? `${(bytes / 1024).toFixed(1)} KB` : null;
                          })()}
                          {doc.document_type && <> · {getDocumentLabel(doc.document_type, 'admin')}</>}
                        </p>
                        {/* Verification state badge — shows staff the current review status of each document */}
                        {doc.verification_status && (
                          <span
                            className="inline-block mt-0.5 text-[10px] px-1.5 py-0.5 rounded font-medium"
                            style={{
                              background: doc.verification_status === 'approved'
                                ? 'rgba(22,163,74,0.1)'
                                : doc.verification_status === 'rejected'
                                  ? 'rgba(220,38,38,0.1)'
                                  : 'rgba(202,138,4,0.1)',
                              color: doc.verification_status === 'approved'
                                ? '#16a34a'
                                : doc.verification_status === 'rejected'
                                  ? '#dc2626'
                                  : '#ca8a04',
                            }}
                          >
                            {doc.verification_status === 'approved'
                              ? 'Verified'
                              : doc.verification_status === 'rejected'
                                ? 'Rejected'
                                : 'Awaiting Review'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                      <button
                        onClick={() => handleView(doc.id)}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                        style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                      >
                        <Eye className="h-3 w-3" />
                        View
                      </button>
                      <button
                        onClick={() => handleDownload(doc.id, doc.name ?? doc.file_name)}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                        style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                      >
                        <Download className="h-3 w-3" />
                        {t('common.download')}
                      </button>
                      {/* Inline verify/reject for pending documents — reviewers can action
                          all uploaded files without leaving the application review page. */}
                      {(!doc.verification_status || doc.verification_status === 'pending') && (() => {
                        const isVerifying = verifyingDocId === doc.id;
                        return (
                          <>
                            <button
                              disabled={isVerifying}
                              onClick={() => handleVerifyDocument(doc.id, 'approved')}
                              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors"
                              style={{
                                borderColor: 'rgba(22,163,74,0.4)',
                                color: '#16a34a',
                                background: 'rgba(22,163,74,0.07)',
                                opacity: isVerifying ? 0.6 : 1,
                              }}
                            >
                              <CheckCircle className="h-3 w-3" />
                              {isVerifying ? '…' : 'Verify'}
                            </button>
                            <button
                              disabled={isVerifying}
                              onClick={() => handleVerifyDocument(doc.id, 'rejected')}
                              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors"
                              style={{
                                borderColor: 'rgba(220,38,38,0.35)',
                                color: '#dc2626',
                                background: 'rgba(220,38,38,0.07)',
                                opacity: isVerifying ? 0.6 : 1,
                              }}
                            >
                              <XCircle className="h-3 w-3" />
                              Reject
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                ))}
              </div>
              );
            })()}
          </SectionCard>

          {/* Digital signature — only shown if the application was signed. */}
          {application.signed_at && (
            <SectionCard title="Digital Signature" icon={<PenLine className="h-4 w-4" />}>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>Signed by</p>
                    <p style={{ color: 'var(--foreground)' }}>{application.signature_name ?? t('common.not_provided')}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>Signed on</p>
                    <p style={{ color: 'var(--foreground)' }}>{format(new Date(application.signed_at), 'MMM d, yyyy h:mm a')}</p>
                  </div>
                </div>
            </SectionCard>
          )}

        </div>

        {/* Right column — sticky review action panel */}
        <div>
          <ReviewPanel
            applicationId={application.id}
            currentStatus={application.status}
            // When a review completes, update the application state so the status badge refreshes.
            onReviewed={setApplication}
          />
        </div>
      </div>
    </div>
  );
}
