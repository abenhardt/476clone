<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Shapes a Document model as a message attachment for the API response.
 *
 * Only exposes the fields the frontend needs for display and download.
 * Keeps storage internals (path, stored_filename, disk) and audit fields
 * (verification_status, is_scanned, etc.) out of the messaging API surface.
 *
 * original_filename is decrypted automatically by the Document model's
 * encrypted cast before this resource receives it.
 */
class MessageAttachmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            // Decrypted by Document model's encrypted cast (stores PHI-safe filenames)
            'original_filename' => $this->original_filename ?? '',
            'mime_type' => $this->mime_type ?? '',
            'file_size' => (int) ($this->file_size ?? 0),
        ];
    }
}
