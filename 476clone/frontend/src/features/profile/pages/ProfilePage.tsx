/**
 * ProfilePage.tsx
 *
 * Full account profile: avatar, personal information, contact/address,
 * emergency contacts, and security (MFA). Accessible for all roles.
 */

import {
  useState,
  useEffect,
  useRef,
  type ReactNode,
  type FormEvent,
  type ChangeEvent,
} from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  User,
  Mail,
  Shield,
  ShieldCheck,
  ShieldOff,
  QrCode,
  Key,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Camera,
  Trash2,
  Plus,
  Phone,
  MapPin,
  Star,
  Pencil,
  X,
  Check,
} from 'lucide-react';
import QRCode from 'react-qr-code';

import {
  getProfile,
  updateProfile,
  uploadAvatar,
  removeAvatar,
  getEmergencyContacts,
  createEmergencyContact,
  updateEmergencyContact,
  deleteEmergencyContact,
  setupMfa,
  verifyMfaSetup,
  disableMfa,
  type MfaSetupResponse,
  type EmergencyContactPayload,
} from '@/features/profile/api/profile.api';
import { resendVerificationEmail } from '@/features/auth/api/auth.api';
import { Avatar } from '@/ui/components/Avatar';
import { Button } from '@/ui/components/Button';
import { Skeletons } from '@/ui/components/Skeletons';
import { useAppDispatch } from '@/store/hooks';
import { patchUser } from '@/features/auth/store/authSlice';
import type { User as UserType, UserEmergencyContact } from '@/shared/types/user.types';

// ---------------------------------------------------------------------------
// Shared section card
// ---------------------------------------------------------------------------

function ProfileSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className="rounded-xl border p-6"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center gap-3 mb-5">
        <div
          className="flex items-center justify-center w-8 h-8 rounded-lg"
          style={{ background: 'rgba(22,163,74,0.1)' }}
        >
          <span style={{ color: 'var(--ember-orange)' }}>{icon}</span>
        </div>
        <h2 className="font-headline font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  icon,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  icon?: ReactNode;
}) {
  return (
    <div
      className="flex items-center gap-2 rounded-lg border px-3 py-2.5"
      style={{ background: 'var(--input)', borderColor: 'var(--border)' }}
    >
      {icon && <span style={{ color: 'var(--muted-foreground)' }}>{icon}</span>}
      <input
        type={type}
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-sm outline-none"
        style={{ color: 'var(--foreground)' }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Avatar section
// ---------------------------------------------------------------------------

function AvatarSection({
  avatarUrl,
  name,
  onUpload,
  onRemove,
}: {
  avatarUrl: string | null | undefined;
  name: string;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const fileRef    = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error('File too large. Please choose an image under 8 MB.');
      e.target.value = '';
      return;
    }
    setBusy(true);
    try {
      await onUpload(file);
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  async function handleRemove() {
    setBusy(true);
    try { await onRemove(); } finally { setBusy(false); }
  }

  return (
    <div className="flex items-center gap-5">
      {/* Avatar circle */}
      <div className="relative flex-shrink-0">
        <Avatar src={avatarUrl} name={name} size="xl" />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="absolute bottom-0 right-0 w-7 h-7 rounded-full flex items-center justify-center border-2 transition-opacity hover:opacity-80"
          style={{
            background: 'var(--ember-orange)',
            borderColor: 'var(--card)',
            color: '#fff',
          }}
          title="Upload photo"
        >
          <Camera className="h-3.5 w-3.5" />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={handleFile}
        />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{name}</p>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()} loading={busy}>
            {avatarUrl ? 'Change photo' : 'Upload photo'}
          </Button>
          {avatarUrl && (
            <Button variant="ghost" size="sm" onClick={handleRemove} loading={busy}>
              Remove
            </Button>
          )}
        </div>
        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          JPG, PNG or WebP · max 8 MB
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Emergency contacts section
// ---------------------------------------------------------------------------

interface ContactFormState {
  name: string;
  relationship: string;
  phone: string;
  email: string;
  is_primary: boolean;
}

const EMPTY_CONTACT_FORM: ContactFormState = {
  name: '', relationship: '', phone: '', email: '', is_primary: false,
};

function EmergencyContactsSection() {
  const [contacts, setContacts]   = useState<UserEmergencyContact[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm]           = useState<ContactFormState>(EMPTY_CONTACT_FORM);
  const [saving, setSaving]       = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    getEmergencyContacts()
      .then(setContacts)
      .catch((err) => {
        console.error('[ProfilePage] Failed to load emergency contacts:', err);
        toast.error('Failed to load emergency contacts.');
      })
      .finally(() => setLoading(false));
  }, []);

  function openAdd() {
    setForm(EMPTY_CONTACT_FORM);
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(contact: UserEmergencyContact) {
    setForm({
      name:         contact.name,
      relationship: contact.relationship,
      phone:        contact.phone,
      email:        contact.email ?? '',
      is_primary:   contact.is_primary,
    });
    setEditingId(contact.id);
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_CONTACT_FORM);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.relationship.trim() || !form.phone.trim()) {
      toast.error('Name, relationship, and phone are required.');
      return;
    }
    setSaving(true);
    try {
      const payload: EmergencyContactPayload = {
        name:         form.name.trim(),
        relationship: form.relationship.trim(),
        phone:        form.phone.trim(),
        email:        form.email.trim() || undefined,
        is_primary:   form.is_primary,
      };

      if (editingId !== null) {
        const updated = await updateEmergencyContact(editingId, payload);
        setContacts((prev) =>
          prev.map((c) => (c.id === editingId ? updated : form.is_primary ? { ...c, is_primary: false } : c))
        );
        toast.success('Contact updated.');
      } else {
        const created = await createEmergencyContact(payload);
        setContacts((prev) => {
          const base = form.is_primary ? prev.map((c) => ({ ...c, is_primary: false })) : prev;
          return [...base, created];
        });
        toast.success('Contact added.');
      }
      cancelForm();
    } catch {
      toast.error('Failed to save contact. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Remove this emergency contact?')) return;
    setDeletingId(id);
    try {
      await deleteEmergencyContact(id);
      setContacts((prev) => prev.filter((c) => c.id !== id));
      toast.success('Contact removed.');
    } catch {
      toast.error('Failed to remove contact.');
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {contacts.length === 0 && !showForm && (
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          No emergency contacts added yet.
        </p>
      )}

      {contacts.map((contact) => (
        <div
          key={contact.id}
          className="flex items-start justify-between gap-3 p-4 rounded-xl border"
          style={{ borderColor: 'var(--border)', background: 'var(--dash-bg)' }}
        >
          <div className="flex items-start gap-3 min-w-0">
            <Avatar name={contact.name} size="md" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  {contact.name}
                </p>
                {contact.is_primary && (
                  <span
                    className="flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(22,163,74,0.10)', color: 'var(--ember-orange)' }}
                  >
                    <Star className="h-2.5 w-2.5" /> Primary
                  </span>
                )}
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                {contact.relationship} · {contact.phone}
              </p>
              {contact.email && (
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{contact.email}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => openEdit(contact)}
              className="p-1.5 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
              title="Edit"
            >
              <Pencil className="h-3.5 w-3.5" style={{ color: 'var(--muted-foreground)' }} />
            </button>
            <button
              type="button"
              onClick={() => handleDelete(contact.id)}
              disabled={deletingId === contact.id}
              className="p-1.5 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
              title="Remove"
            >
              <Trash2 className="h-3.5 w-3.5" style={{ color: 'var(--destructive)' }} />
            </button>
          </div>
        </div>
      ))}

      {showForm && (
        <div
          className="p-4 rounded-xl border flex flex-col gap-3"
          style={{ borderColor: 'var(--ember-orange)', background: 'rgba(22,101,52,0.04)' }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>
            {editingId !== null ? 'Edit contact' : 'New contact'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FieldRow label="Full name *">
              <TextInput value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Full name" />
            </FieldRow>
            <FieldRow label="Relationship *">
              <TextInput value={form.relationship} onChange={(v) => setForm((f) => ({ ...f, relationship: v }))} placeholder="e.g. Spouse, Parent" />
            </FieldRow>
            <FieldRow label="Phone *">
              <TextInput value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} placeholder="Phone number" type="tel" icon={<Phone className="h-4 w-4" />} />
            </FieldRow>
            <FieldRow label="Email">
              <TextInput value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} placeholder="Email (optional)" type="email" icon={<Mail className="h-4 w-4" />} />
            </FieldRow>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: 'var(--foreground)' }}>
            <input
              type="checkbox"
              checked={form.is_primary}
              onChange={(e) => setForm((f) => ({ ...f, is_primary: e.target.checked }))}
              className="rounded"
            />
            Set as primary emergency contact
          </label>
          <div className="flex items-center gap-2 pt-1">
            <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
              <Check className="h-3.5 w-3.5" />
              {editingId !== null ? 'Save changes' : 'Add contact'}
            </Button>
            <Button variant="ghost" size="sm" onClick={cancelForm}>
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
          </div>
        </div>
      )}

      {!showForm && (
        <Button variant="secondary" size="sm" onClick={openAdd} className="self-start flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Add contact
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MFA section (unchanged logic, same UI)
// ---------------------------------------------------------------------------

function MfaSection({
  mfaEnabled,
  onToggle,
}: {
  mfaEnabled: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const [setup, setSetup]           = useState<MfaSetupResponse | null>(null);
  const [code, setCode]             = useState('');
  const [loading, setLoading]       = useState(false);
  const [phase, setPhase]           = useState<'idle' | 'setup' | 'disabling'>('idle');
  const [disableCode, setDisableCode]         = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [showDisablePw, setShowDisablePw]     = useState(false);

  async function handleStartSetup() {
    setLoading(true);
    try {
      const res = await setupMfa();
      setSetup(res);
      setPhase('setup');
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? t('profile.mfa.setup_error'));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (code.length !== 6) return;
    setLoading(true);
    try {
      await verifyMfaSetup(code);
      toast.success(t('profile.mfa.enabled_success'));
      setPhase('idle'); setSetup(null); setCode('');
      onToggle();
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? t('profile.mfa.verify_error'));
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable() {
    if (disableCode.length !== 6 || !disablePassword) return;
    setLoading(true);
    try {
      await disableMfa({ code: disableCode, password: disablePassword });
      toast.success(t('profile.mfa.disabled_success'));
      setPhase('idle'); setDisableCode(''); setDisablePassword('');
      onToggle();
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? t('profile.mfa.disable_error'));
    } finally {
      setLoading(false);
    }
  }

  if (mfaEnabled) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5" style={{ color: '#16a34a' }} />
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{t('profile.mfa.enabled')}</p>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{t('profile.mfa.enabled_desc')}</p>
            </div>
          </div>
          {phase !== 'disabling' && (
            <Button variant="ghost" size="sm" onClick={() => setPhase('disabling')} icon={<ShieldOff className="h-4 w-4" />} style={{ color: 'var(--destructive)' }}>
              {t('profile.mfa.disable')}
            </Button>
          )}
        </div>
        {phase === 'disabling' && (
          <div className="rounded-xl border p-4 space-y-3" style={{ background: 'rgba(239,68,68,0.04)', borderColor: 'rgba(239,68,68,0.2)' }}>
            <p className="text-xs font-medium" style={{ color: 'var(--destructive)' }}>{t('profile.mfa.disable_confirm')}</p>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>{t('profile.mfa.disable_code_label')}</label>
              <input value={disableCode} onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000"
                className="w-32 rounded-lg px-3 py-2 text-sm border outline-none font-mono text-center tracking-widest"
                style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>{t('profile.mfa.disable_password_label')}</label>
              <div className="relative w-56">
                <input type={showDisablePw ? 'text' : 'password'} value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)} placeholder="Your password"
                  className="w-full rounded-lg px-3 py-2 pr-9 text-sm border outline-none"
                  style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }} />
                <button type="button" className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} onClick={() => setShowDisablePw((v) => !v)}>
                  {showDisablePw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button variant="primary" size="sm" loading={loading} onClick={handleDisable} disabled={disableCode.length !== 6 || !disablePassword} style={{ background: 'var(--destructive)' }}>
                {t('profile.mfa.disable_submit')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setPhase('idle'); setDisableCode(''); setDisablePassword(''); }}>Cancel</Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (phase === 'setup' && setup) {
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0" style={{ background: 'rgba(22,163,74,0.1)' }}>
            <span className="text-sm font-bold" style={{ color: '#16a34a' }}>1</span>
          </div>
          <div>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>{t('profile.mfa.step1_title')}</p>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{t('profile.mfa.step1_desc')}</p>
          </div>
        </div>
        <div className="flex justify-center">
          <div className="glass-data p-4 rounded-xl">
            <QRCode value={setup.qr_code_url} size={144} />
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--muted)' }}>
          <Key className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
          <p className="text-xs font-mono break-all" style={{ color: 'var(--muted-foreground)' }}>{setup.secret}</p>
        </div>
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0" style={{ background: 'rgba(22,163,74,0.1)' }}>
            <span className="text-sm font-bold" style={{ color: '#16a34a' }}>2</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>{t('profile.mfa.step2_title')}</p>
            <div className="flex gap-2">
              <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000"
                className="w-32 rounded-lg px-3 py-2 text-sm border outline-none font-mono text-center tracking-widest"
                style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }} />
              <Button variant="primary" size="sm" loading={loading} onClick={handleVerify} disabled={code.length !== 6}>{t('profile.mfa.verify')}</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Shield className="h-5 w-5" style={{ color: 'var(--muted-foreground)' }} />
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{t('profile.mfa.disabled')}</p>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{t('profile.mfa.disabled_desc')}</p>
        </div>
      </div>
      <Button variant="secondary" size="sm" loading={loading} onClick={handleStartSetup} icon={<QrCode className="h-4 w-4" />}>
        {t('profile.mfa.enable')}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function ProfilePage() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const location = useLocation();
  // Arrive here via ProtectedRoute MFA enrollment gate — show setup banner.
  const mfaSetupRequired = (location.state as { mfaSetupRequired?: boolean } | null)?.mfaSetupRequired ?? false;

  const [profile, setProfile] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  // Personal info form state
  const [name, setName]                   = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [email, setEmail]                 = useState('');
  const [phone, setPhone]                 = useState('');

  // Address form state
  const [address1, setAddress1]     = useState('');
  const [address2, setAddress2]     = useState('');
  const [city, setCity]             = useState('');
  const [state, setState]           = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry]       = useState('US');

  const [savingAddress, setSavingAddress] = useState(false);

  useEffect(() => {
    getProfile()
      .then((p) => {
        setProfile(p);
        setName(p.name);
        setPreferredName(p.preferred_name ?? '');
        setEmail(p.email);
        setPhone(p.phone ?? '');
        setAddress1(p.address_line_1 ?? '');
        setAddress2(p.address_line_2 ?? '');
        setCity(p.city ?? '');
        setState(p.state ?? '');
        setPostalCode(p.postal_code ?? '');
        setCountry(p.country ?? 'US');
      })
      .catch((err) => {
        console.error('[ProfilePage] Failed to load profile:', err);
        toast.error('Failed to load profile. Please refresh the page.');
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSavePersonal(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await updateProfile({
        name,
        preferred_name: preferredName || null,
        email,
        phone: phone || null,
      });
      setProfile(updated);
      dispatch(patchUser({ name: updated.name, preferred_name: updated.preferred_name, email: updated.email, phone: updated.phone }));
      toast.success(t('profile.save_success'));
    } catch {
      toast.error(t('common.save_error'));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAddress(e: FormEvent) {
    e.preventDefault();
    setSavingAddress(true);
    try {
      const updated = await updateProfile({
        address_line_1: address1 || null,
        address_line_2: address2 || null,
        city: city || null,
        state: state || null,
        postal_code: postalCode || null,
        country: country || null,
      });
      setProfile(updated);
      dispatch(patchUser({ address_line_1: updated.address_line_1, address_line_2: updated.address_line_2, city: updated.city, state: updated.state, postal_code: updated.postal_code, country: updated.country }));
      toast.success('Address saved.');
    } catch {
      toast.error(t('common.save_error'));
    } finally {
      setSavingAddress(false);
    }
  }

  async function handleAvatarUpload(file: File) {
    try {
      const { avatar_url } = await uploadAvatar(file);
      setProfile((p) => p ? { ...p, avatar_url } : p);
      dispatch(patchUser({ avatar_url }));
      toast.success('Profile photo updated.');
    } catch (err) {
      const msg = (err as { message?: string })?.message;
      toast.error(msg ? `Upload failed: ${msg}` : 'Failed to upload photo. Please try again.');
    }
  }

  async function handleAvatarRemove() {
    try {
      await removeAvatar();
      setProfile((p) => p ? { ...p, avatar_url: null, avatar_path: null } : p);
      dispatch(patchUser({ avatar_url: null, avatar_path: null }));
      toast.success('Profile photo removed.');
    } catch {
      toast.error('Failed to remove photo. Please try again.');
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-2xl space-y-4">
        <Skeletons.Block height={32} width={200} />
        <Skeletons.Card />
        <Skeletons.Card />
        <Skeletons.Card />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      {mfaSetupRequired && (
        <div
          className="mb-5 rounded-lg border px-4 py-3 text-sm"
          style={{
            background: 'rgba(234,88,12,0.08)',
            borderColor: 'rgba(234,88,12,0.4)',
            color: 'var(--foreground)',
          }}
        >
          <strong>MFA setup required.</strong> Your role requires multi-factor authentication to be enabled before you can access protected resources. Please configure MFA in the Security section below.
        </div>
      )}
      <div className="mb-7">
        <h1 className="font-headline text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          {t('profile.title')}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          {t('profile.subtitle')}
        </p>
      </div>


      <div className="space-y-5">

        {/* ── Avatar ─────────────────────────────────────────────────── */}
        <div>
          <ProfileSection title="Profile Photo" icon={<Camera className="h-4 w-4" />}>
            <AvatarSection
              avatarUrl={profile?.avatar_url}
              name={profile?.name ?? ''}
              onUpload={handleAvatarUpload}
              onRemove={handleAvatarRemove}
            />
          </ProfileSection>
        </div>

        {/* ── Personal Information ────────────────────────────────────── */}
        <div>
          <ProfileSection title={t('profile.personal_title')} icon={<User className="h-4 w-4" />}>
            <form onSubmit={handleSavePersonal} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FieldRow label={t('profile.name_label')}>
                  <TextInput value={name} onChange={setName} placeholder="Full name" icon={<User className="h-4 w-4" />} />
                </FieldRow>
                <FieldRow label="Preferred name (optional)">
                  <TextInput value={preferredName} onChange={setPreferredName} placeholder="Nickname" />
                </FieldRow>
              </div>
              <FieldRow label={t('profile.phone_label', { defaultValue: 'Phone number' })}>
                <TextInput value={phone} onChange={setPhone} placeholder="+1 (555) 000-0000" type="tel" icon={<Phone className="h-4 w-4" />} />
              </FieldRow>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                    {t('profile.email_label')}
                  </label>
                  {profile?.email_verified_at ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(22,163,74,0.10)', color: 'var(--ember-orange)' }}>
                      <CheckCircle className="h-3 w-3" /> Verified
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(217,119,6,0.10)', color: '#b45309' }}>
                        <AlertCircle className="h-3 w-3" /> Not verified
                      </span>
                      <button type="button" onClick={async () => {
                        try {
                          await resendVerificationEmail();
                          toast.success('Verification email sent. Check your inbox.');
                        } catch {
                          toast.error('Could not send verification email. Please try again.');
                        }
                      }} className="text-xs hover:underline" style={{ color: 'var(--ember-orange)' }}>
                        Resend
                      </button>
                    </div>
                  )}
                </div>
                <TextInput value={email} onChange={setEmail} type="email" icon={<Mail className="h-4 w-4" />} />
              </div>
              <div className="flex justify-end pt-1">
                <Button type="submit" variant="primary" size="sm" loading={saving}>
                  {t('profile.save')}
                </Button>
              </div>
            </form>
          </ProfileSection>
        </div>

        {/* ── Contact / Address ──────────────────────────────────────── */}
        <div>
          <ProfileSection title="Contact Information" icon={<MapPin className="h-4 w-4" />}>
            <form onSubmit={handleSaveAddress} className="space-y-4">
              <FieldRow label="Address line 1">
                <TextInput value={address1} onChange={setAddress1} placeholder="Street address" />
              </FieldRow>
              <FieldRow label="Address line 2">
                <TextInput value={address2} onChange={setAddress2} placeholder="Apartment, suite, etc." />
              </FieldRow>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FieldRow label="City">
                  <TextInput value={city} onChange={setCity} placeholder="City" />
                </FieldRow>
                <FieldRow label="State / Province">
                  <TextInput value={state} onChange={setState} placeholder="SC" />
                </FieldRow>
                <FieldRow label="Postal code">
                  <TextInput value={postalCode} onChange={setPostalCode} placeholder="ZIP" />
                </FieldRow>
              </div>
              <FieldRow label="Country">
                <TextInput value={country} onChange={setCountry} placeholder="US" />
              </FieldRow>
              <div className="flex justify-end pt-1">
                <Button type="submit" variant="primary" size="sm" loading={savingAddress}>
                  Save address
                </Button>
              </div>
            </form>
          </ProfileSection>
        </div>

        {/* ── Emergency contacts ─────────────────────────────────────── */}
        <div>
          <ProfileSection title="Emergency Contacts" icon={<Phone className="h-4 w-4" />}>
            <EmergencyContactsSection />
          </ProfileSection>
        </div>

        {/* ── Security / MFA ─────────────────────────────────────────── */}
        <div>
          <ProfileSection title={t('profile.mfa.title')} icon={<Shield className="h-4 w-4" />}>
            <MfaSection
              mfaEnabled={!!profile?.mfa_enabled}
              onToggle={() => {
                const newValue = !(profile?.mfa_enabled ?? false);
                setProfile((p) => p ? { ...p, mfa_enabled: newValue } : p);
                // Sync to Redux so the global MFA banner reacts immediately.
                dispatch(patchUser({ mfa_enabled: newValue }));
              }}
            />
          </ProfileSection>
        </div>

      </div>
    </div>
  );
}
