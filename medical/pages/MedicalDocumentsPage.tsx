/**
 * MedicalDocumentsPage.tsx
 *
 * Documents section for a single camper within the Medical Portal.
 * Camp medical staff can view existing documents and upload new ones.
 *
 * Route: /medical/records/:camperId/documents
 */

import { useState, useEffect, useCallback, useRef, type DragEvent } from 'react';
import { useParams, Link } from 'react-router-dom';

import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, FileText, Upload, Download, File,
  CheckCircle, AlertCircle, Loader2, X, Clock,
} from 'lucide-react';

import {
  getCamperDocuments,
  uploadDocument,
  downloadDocument,
} from '@/features/medical/api/medical.api';
import { getCamper } from '@/features/admin/api/admin.api';
import { Skeletons } from '@/ui/components/Skeletons';
import { EmptyState } from '@/ui/components/EmptyState';

import type { Camper, Document } from '@/features/admin/types/admin.types';

// ─── Status badge ─────────────────────────────────────────────────────────────

function DocStatusBadge({ doc }: { doc: Document & { scan_passed?: boolean | null; verification_status?: string } }) {
  if (doc.scan_passed === false) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(220,38,38,0.10)', color: 'var(--destructive)' }}>
        <AlertCircle className="h-3 w-3" /> Failed security check
      </span>
    );
  }
  if (doc.scan_passed === null || doc.scan_passed === undefined) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(96,165,250,0.10)', color: 'var(--night-sky-blue)' }}>
        <Clock className="h-3 w-3" /> Pending review
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(5,150,105,0.10)', color: 'var(--forest-green)' }}>
      <CheckCircle className="h-3 w-3" /> Available
    </span>
  );
}

// ─── Upload row ───────────────────────────────────────────────────────────────

interface PendingUpload {
  id: string;
  file: File;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  error?: string;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function MedicalDocumentsPage() {
  const { t } = useTranslation();
  const { camperId } = useParams<{ camperId: string }>();
  const id = Number(camperId);

  const [camper, setCamper] = useState<Camper | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [c, docs] = await Promise.all([
        getCamper(id),
        getCamperDocuments(id),
      ]);
      setCamper(c);
      setDocuments(docs.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id, retryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void load(); }, [load]);

  // ─── Upload ──────────────────────────────────────────────────────────────────

  const handleFiles = async (files: File[]) => {
    for (const file of files) {
      const localId = typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      setPending((prev) => [...prev, { id: localId, file, progress: 0, status: 'uploading' }]);

      try {
        const doc = await uploadDocument({
          file,
          documentable_type: 'App\\Models\\Camper',
          documentable_id: id,
          document_type: 'medical',
        });

        setPending((prev) => prev.map((p) => p.id === localId ? { ...p, status: 'success' as const, progress: 100 } : p));
        setDocuments((prev) => [doc, ...prev]);

        setTimeout(() => {
          setPending((prev) => prev.filter((p) => p.id !== localId));
        }, 3000);
      } catch {
        setPending((prev) => prev.map((p) => p.id === localId
          ? { ...p, status: 'error' as const, error: 'Upload failed. Please try again.' }
          : p
        ));
      }
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    void handleFiles(Array.from(e.dataTransfer.files));
  };

  // ─── Download ────────────────────────────────────────────────────────────────

  const handleDownload = async (doc: Document) => {
    setDownloading(doc.id);
    try {
      const blob = await downloadDocument(doc.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name ?? `document-${doc.id}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="p-6 max-w-4xl">

      {/* Back */}
      <Link
        to={`/medical/records/${id}`}
        className="inline-flex items-center gap-2 text-sm mb-6 transition-colors"
        style={{ color: 'var(--muted-foreground)' }}
      >
        <ArrowLeft className="h-4 w-4" />
        {t('medical.record.back_to_record')}
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(96,165,250,0.1)' }}>
            <FileText className="h-3.5 w-3.5" style={{ color: 'var(--night-sky-blue)' }} />
          </div>
          <h1 className="font-headline text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
            {t('medical.documents.title')}
          </h1>
        </div>
        {camper && (
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            {camper.full_name}
          </p>
        )}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer mb-6 transition-colors hover:border-[var(--ember-orange)]/60"
        style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
        role="button"
        tabIndex={0}
        aria-label="Upload documents"
        onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={(e) => void handleFiles(Array.from(e.target.files ?? []))}
        />
        <Upload className="h-8 w-8 mx-auto mb-3" style={{ color: 'var(--muted-foreground)' }} />
        <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
          {t('medical.documents.drop_hint')}{' '}
          <span style={{ color: 'var(--ember-orange)' }}>{t('medical.documents.browse')}</span>
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
          {t('medical.documents.accepted')}
        </p>
      </div>

      {/* Pending uploads */}
      {pending.length > 0 && (
        <>
          <div className="mb-4 space-y-2">
            {pending.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-xl border px-4 py-3"
                style={{
                  background: 'var(--card)',
                  borderColor: p.status === 'error' ? 'rgba(220,38,38,0.3)' : p.status === 'success' ? 'rgba(22,163,74,0.3)' : 'var(--border)',
                }}
              >
                {p.status === 'uploading' && <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" style={{ color: 'var(--ember-orange)' }} />}
                {p.status === 'success' && <CheckCircle className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--forest-green)' }} />}
                {p.status === 'error' && <AlertCircle className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--destructive)' }} />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate" style={{ color: 'var(--foreground)' }}>{p.file.name}</p>
                  {p.status === 'error' && <p className="text-xs" style={{ color: 'var(--destructive)' }}>{p.error}</p>}
                  {p.status === 'uploading' && (
                    <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                      <div className="h-full rounded-full animate-pulse" style={{ width: '60%', background: 'var(--ember-orange)' }} />
                    </div>
                  )}
                </div>
                {p.status === 'error' && (
                  <button onClick={() => setPending((prev) => prev.filter((x) => x.id !== p.id))} style={{ color: 'var(--muted-foreground)' }}>
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Document list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeletons.Card key={i} />)}
        </div>
      ) : error ? (
        <EmptyState
          title={t('common.error_loading')}
          description={t('common.try_again')}
          action={{ label: t('common.retry'), onClick: () => setRetryKey((k) => k + 1) }}
        />
      ) : documents.length === 0 ? (
        <EmptyState
          title={t('medical.documents.empty_title')}
          description={t('medical.documents.empty_desc')}
        />
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-4 rounded-xl border px-5 py-4"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(96,165,250,0.1)' }}>
                <File className="h-4 w-4" style={{ color: 'var(--night-sky-blue)' }} />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{doc.file_name}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    {doc.size ? formatSize(doc.size) : ''} &middot; {formatDate(doc.created_at)}
                  </span>
                  <DocStatusBadge doc={doc as Document & { scan_passed?: boolean | null }} />
                </div>
              </div>

              <button
                onClick={() => void handleDownload(doc)}
                disabled={downloading === doc.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                {downloading === doc.id
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Download className="h-3.5 w-3.5" />}
                {t('common.download')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
