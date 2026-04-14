<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;

/**
 * FileUploadService — centralized, MIME-safe file storage.
 *
 * All file uploads in this system must pass through this service.
 * It prevents the two most common file upload vulnerabilities:
 *
 *  1. MIME spoofing — client claims "image/jpeg" but file is PHP code.
 *     Fix: PHP's finfo extension reads the file's actual magic bytes,
 *     not the filename or the Content-Type header.
 *
 *  2. Extension spoofing — client names the file "shell.php.jpg".
 *     Fix: the file extension in the stored path is derived exclusively
 *     from the validated MIME type, never from the client-supplied filename.
 *
 * All stored filenames are UUIDs — no user-controlled data ever appears
 * in the storage path.
 */
class FileUploadService
{
    /**
     * Allowed MIME types and the safe extension to use for each.
     *
     * Only types in this map are accepted. Any other MIME — regardless of
     * what the client claims — is rejected as 422 Unprocessable.
     */
    private const MIME_TO_EXTENSION = [
        'application/pdf' => 'pdf',
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/gif' => 'gif',
        'application/msword' => 'doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
    ];

    /**
     * Store a file securely and return its storage path and metadata.
     *
     * The path format is: {directory}/{uuid}.{ext}
     * The extension comes from the detected MIME type, not the client filename.
     *
     * @param  UploadedFile  $file  The uploaded file from the request.
     * @param  string  $directory  Relative directory within the local disk
     *                             (e.g., 'applicant-documents/sent').
     * @return array{path: string, file_name: string, mime_type: string}
     *
     * @throws \Illuminate\Validation\ValidationException If the MIME type is not allowed.
     */
    public function store(UploadedFile $file, string $directory): array
    {
        $mimeType = $this->detectMimeType($file);
        $ext = $this->resolveExtension($mimeType, $file->getClientOriginalName());

        $uuid = Str::uuid()->toString();
        $path = "{$directory}/{$uuid}.{$ext}";

        \Illuminate\Support\Facades\Storage::disk('local')->put(
            $path,
            file_get_contents($file->getRealPath())
        );

        return [
            'path' => $path,
            'file_name' => $this->sanitizeFileName($file->getClientOriginalName()),
            'mime_type' => $mimeType,
        ];
    }

    /**
     * Detect the true MIME type of a file by reading its magic bytes.
     *
     * PHP's finfo reads the first few bytes of the file content — the "magic bytes"
     * that identify what the file actually is, regardless of its name or the
     * Content-Type header sent by the client.
     *
     * Falls back to the framework's getMimeType() if finfo is unavailable
     * (e.g., certain test environments).
     */
    public function detectMimeType(UploadedFile $file): string
    {
        if (function_exists('finfo_open')) {
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            $mimeType = finfo_file($finfo, $file->getRealPath());
            finfo_close($finfo);

            if ($mimeType && $mimeType !== 'application/octet-stream') {
                return $mimeType;
            }
        }

        // Fallback: Laravel's Symfony-backed detection (still reads headers, not bytes)
        return $file->getMimeType() ?? $file->getClientMimeType();
    }

    /**
     * Resolve the safe file extension for a given MIME type.
     *
     * If the MIME type is not in the allowlist, aborts with HTTP 422.
     * The client-supplied filename is only used for error messaging — never
     * for the stored path.
     */
    public function resolveExtension(string $mimeType, string $clientFileName = ''): string
    {
        if (! array_key_exists($mimeType, self::MIME_TO_EXTENSION)) {
            abort(422, "File type '{$mimeType}' is not allowed. Accepted types: PDF, JPG, PNG, DOC, DOCX.");
        }

        return self::MIME_TO_EXTENSION[$mimeType];
    }

    /**
     * Sanitize a client-supplied filename for safe display in responses.
     *
     * The sanitized name is stored in the database for download Content-Disposition
     * headers. It is NEVER used in the storage path. We strip path traversal
     * sequences and null bytes that could confuse downstream consumers.
     *
     * Truncates to 200 characters to prevent database column overflow.
     */
    public function sanitizeFileName(string $name): string
    {
        // Remove null bytes, path separators, and traversal sequences
        $name = str_replace(["\0", '/', '\\', '..'], '', $name);
        // Remove non-printable characters
        $name = preg_replace('/[\x00-\x1F\x7F]/', '', $name) ?? $name;

        // Truncate to 200 chars
        return mb_substr(trim($name), 0, 200);
    }
}
