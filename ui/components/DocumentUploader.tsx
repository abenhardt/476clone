/**
 * DocumentUploader.tsx
 *
 * Purpose: A drag-and-drop file upload zone with per-file progress bars and
 * status indicators.
 *
 * Responsibilities:
 *   - Accepts PDF, JPEG, and PNG files up to 10 MB each.
 *   - Validates file type and size before uploading; silently rejects invalid files.
 *   - Uploads each valid file immediately via POST /api/documents (multipart/form-data).
 *   - Tracks per-file upload progress using Axios's onUploadProgress callback.
 *   - Calls `onUploaded(document)` after each successful upload so the parent
 *     can add the new document to its own list.
 *   - Calls `onRemoved(documentId)` when the user clicks the X on a file row
 *     so the parent can remove the document from its state.
 *   - Supports both drag-and-drop and click-to-browse interactions.
 *   - Supports keyboard access (Enter key triggers the file browser).
 */

import { useCallback, useRef, useState, type DragEvent } from 'react';
import { Upload, File, X, CheckCircle, AlertCircle } from 'lucide-react';
import axiosInstance from '@/api/axios.config';
import type { Document } from '@/shared/types';
import { cn } from '@/shared/utils/cn';

// MIME types the component accepts — must match Document::ALLOWED_MIME_TYPES on the backend.
// webp is intentionally excluded: the backend does not accept it (no entry in ALLOWED_MIME_TYPES).
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_SIZE_MB = 10;

/** Tracks the state of a single file from selection through upload completion. */
interface UploadedFile {
  id: string; // local UUID key — not related to the server document ID
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  /** Populated after a successful upload so the remove button can call onRemoved. */
  document?: Document;
  error?: string;
}

interface DocumentUploaderProps {
  /** Called with the server Document object after each successful upload. */
  onUploaded: (document: Document) => void;
  /** Called with the server document ID when the user removes a successfully uploaded file. */
  onRemoved: (documentId: number) => void;
  label?: string;
  /** Hint text below the drop zone describing accepted types and size limit. */
  hint?: string;
}

export function DocumentUploader({
  onUploaded,
  onRemoved,
  label = 'Upload documents',
  hint = 'PDF, JPG, PNG up to 10 MB each',
}: DocumentUploaderProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  // isDragging is true while a file is being dragged over the drop zone.
  const [isDragging, setIsDragging] = useState(false);
  // Ref to the hidden <input type="file"> — clicked programmatically when the zone is clicked.
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Uploads a single file to the server.
   * Updates the file's progress, status, and document reference in local state
   * as the upload progresses and completes.
   */
  const uploadFile = async (localFile: UploadedFile) => {
    const formData = new FormData();
    formData.append('file', localFile.file);

    // Switch to uploading state before the request starts.
    setFiles((prev) =>
      prev.map((f) =>
        f.id === localFile.id ? { ...f, status: 'uploading', progress: 0 } : f
      )
    );

    try {
      const { data } = await axiosInstance.post('/documents', formData, {
        headers: { 'Content-Type': undefined },
        // onUploadProgress fires repeatedly as chunks are sent — use it to update the progress bar.
        onUploadProgress: (event) => {
          const progress = event.total
            ? Math.round((event.loaded * 100) / event.total)
            : 0;
          setFiles((prev) =>
            prev.map((f) =>
              f.id === localFile.id ? { ...f, progress } : f
            )
          );
        },
      });

      const document = data.data as Document;
      // Mark the file as successfully uploaded and store the server document object.
      setFiles((prev) =>
        prev.map((f) =>
          f.id === localFile.id
            ? { ...f, status: 'success', progress: 100, document }
            : f
        )
      );
      onUploaded(document);
    } catch {
      // Show an error state on this file row without affecting other uploads.
      setFiles((prev) =>
        prev.map((f) =>
          f.id === localFile.id
            ? { ...f, status: 'error', error: 'Upload failed. Please try again.' }
            : f
        )
      );
    }
  };

  /**
   * Validates and enqueues new files for upload.
   * Files that fail the type or size check are silently discarded.
   * useCallback prevents this function from being re-created on every render
   * (which would cause the uploadFile closures inside to be stale).
   */
  const addFiles = useCallback(
    (incoming: File[]) => {
      const valid = incoming.filter((file) => {
        if (!ACCEPTED_TYPES.includes(file.type)) return false;
        if (file.size > MAX_SIZE_MB * 1024 * 1024) return false;
        return true;
      });

      // Create a local tracking entry for each valid file before uploading.
      const newFiles: UploadedFile[] = valid.map((file) => ({
        id: (typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`), // unique key for React list rendering
        file,
        progress: 0,
        status: 'pending',
      }));

      setFiles((prev) => [...prev, ...newFiles]);
      // Kick off uploads in parallel — each file manages its own state independently.
      newFiles.forEach(uploadFile);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  /** Handles files dropped onto the zone. */
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  };

  /**
   * Removes a file from the local list.
   * If the upload succeeded, also notifies the parent to remove the server document.
   */
  const handleRemove = (localFile: UploadedFile) => {
    if (localFile.document) {
      onRemoved(localFile.document.id);
    }
    setFiles((prev) => prev.filter((f) => f.id !== localFile.id));
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Optional section label above the drop zone */}
      {label && (
        <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
          {label}
        </p>
      )}

      {/* ── Drop zone ── */}
      <div
        // Track drag enter/leave to update border color.
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        // Clicking anywhere on the zone triggers the hidden file input.
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer',
          'transition-all duration-300',
          // Orange border while dragging; lighter orange hover on idle.
          isDragging ? 'border-ember-orange' : 'border-on-image-border hover:border-ember-orange/60'
        )}
        style={{
          // Subtle green tint while dragging to reinforce the "drop here" affordance.
          background: isDragging ? 'rgba(22,163,74,0.06)' : 'var(--card)',
        }}
        role="button"
        tabIndex={0}
        aria-label="Upload files"
        // Allow keyboard users to open the file browser with Enter.
        onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
      >
        {/* Hidden native file input — triggered by clicks on the visible zone */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={(e) => addFiles(Array.from(e.target.files ?? []))}
          aria-hidden="true"
        />

        {/* Upload icon changes color while dragging for extra visual feedback */}
        <Upload
          className="h-8 w-8 mx-auto mb-3"
          style={{ color: isDragging ? 'var(--ember-orange)' : 'var(--muted-foreground)' }}
        />
        <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
          Drop files here or{' '}
          <span className="text-ember-orange">click to browse</span>
        </p>
        {/* Hint text shows accepted formats and size limit */}
        {hint && (
          <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
            {hint}
          </p>
        )}
      </div>

      {/* ── File list ── */}
      {files.length > 0 && (
        <ul className="flex flex-col gap-2">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-3 rounded-xl border px-4 py-3"
              style={{
                background: 'var(--card)',
                // Border color signals the outcome: red=error, green=success, gray=pending/uploading.
                borderColor: f.status === 'error'
                  ? 'rgba(220,38,38,0.3)'
                  : f.status === 'success'
                  ? 'rgba(22,163,74,0.3)'
                  : 'var(--border)',
              }}
            >
              {/* Status icon on the left */}
              <div className="flex-shrink-0">
                {f.status === 'success' ? (
                  <CheckCircle className="h-5 w-5" style={{ color: 'var(--forest-green)' }} />
                ) : f.status === 'error' ? (
                  <AlertCircle className="h-5 w-5" style={{ color: 'var(--destructive)' }} />
                ) : (
                  // Neutral file icon while pending or uploading.
                  <File className="h-5 w-5" style={{ color: 'var(--muted-foreground)' }} />
                )}
              </div>

              {/* File name + progress bar / error message */}
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium truncate"
                  style={{ color: 'var(--foreground)' }}
                >
                  {f.file.name}
                </p>
                {/* Progress bar — only visible while the upload is in flight */}
                {f.status === 'uploading' && (
                  <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-100"
                      style={{
                        background: 'var(--ember-orange)',
                        width: `${f.progress}%`,
                      }}
                    />
                  </div>
                )}
                {/* Error message below the file name on failure */}
                {f.status === 'error' && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--destructive)' }}>
                    {f.error}
                  </p>
                )}
              </div>

              {/* Remove button — notifies parent and removes from local list */}
              <button
                type="button"
                onClick={() => handleRemove(f)}
                className="flex-shrink-0 p-1 rounded hover:bg-[var(--dash-nav-hover-bg)]"
                style={{ color: 'var(--muted-foreground)' }}
                aria-label={`Remove ${f.file.name}`}
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
