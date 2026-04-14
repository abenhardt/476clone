/**
 * messaging.api.ts
 *
 * All inbox/messaging API calls: conversations, messages, attachments.
 *
 * Gmail-style TO/CC/BCC support:
 *   - sendMessage() accepts an optional recipients array with { user_id, type: 'to'|'cc'|'bcc' }
 *   - Message responses include a `recipients` array, filtered server-side per BCC rules:
 *       Sender sees: TO + CC + BCC
 *       TO/CC recipients see: TO + CC only
 *       BCC recipients see: TO + CC only (their BCC status is never revealed)
 *   - replyToMessage() / replyAllToMessage() use server-computed recipients to prevent BCC leakage
 */

import { axiosInstance } from '@/api/axios.config';
import type { ApiResponse, PaginatedResponse } from '@/shared/types/api.types';

// ─── Recipient types ──────────────────────────────────────────────────────────

/** Whether a user received the message as a direct recipient, courtesy copy, or blind copy. */
export type RecipientType = 'to' | 'cc' | 'bcc';

/**
 * A TO/CC/BCC entry on a specific message.
 * BCC entries are only present for the original sender — the server filters them out for everyone else.
 */
export interface MessageRecipient {
  id: number;
  user_id: number;
  recipient_type: RecipientType;
  /** Minimal user info for display (never exposes PHI). */
  user: {
    id: number;
    name: string;
    email: string;
  } | null;
}

/** One entry in the recipients array passed when composing a new message. */
export interface RecipientEntry {
  user_id: number;
  type: RecipientType;
}

// ─── Core types ───────────────────────────────────────────────────────────────

export type SystemEventCategory = 'application' | 'security' | 'role' | 'medical';
export type InboxFolder = 'inbox' | 'starred' | 'important' | 'sent' | 'archive' | 'trash' | 'system' | 'announcements' | 'all';

export interface Conversation {
  id: number;
  subject?: string;
  category?: MessageCategory;
  created_by_id?: number;
  participants: ConversationParticipant[];
  last_message?: Message;
  unread_count: number;
  is_archived: boolean;
  archived_at?: string;
  // Per-user state (backed by conversation_participants pivot)
  is_starred: boolean;
  is_important: boolean;
  is_trashed: boolean;
  created_at: string;
  updated_at: string;
  // System notification fields (populated when is_system_generated === true)
  is_system_generated: boolean;
  system_event_type?: string;
  system_event_category?: SystemEventCategory;
  related_entity_type?: string;
  related_entity_id?: number;
}

export interface ConversationParticipant {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar_url?: string | null;
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number | null;  // null for system-generated messages
  sender?: ConversationParticipant;
  body: string;
  read_at?: string;
  created_at: string;
  attachments?: MessageAttachment[];
  /**
   * Visible TO/CC/BCC recipients for the current user.
   * BCC filtering is applied server-side:
   *   - Sender sees all (TO + CC + BCC)
   *   - Everyone else sees only TO + CC
   * Empty array means no explicit recipients were set (legacy message — all participants are implicit TO).
   */
  recipients: MessageRecipient[];
  /** ID of the message this is a reply to, or null for root messages. */
  parent_message_id: number | null;
  /** How this message was sent: 'reply', 'reply_all', or null for new messages. */
  reply_type: 'reply' | 'reply_all' | null;
}

export interface MessageAttachment {
  id: number;
  original_filename: string;
  mime_type: string;
  file_size: number;
}

export type MessageCategory = 'general' | 'medical' | 'application' | 'other';

export interface NewConversationPayload {
  subject?: string;
  /** All participant IDs (TO + CC + BCC combined). Recipient types are stored on the first message. */
  participant_ids: number[];
  category?: MessageCategory;
}

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

export async function getConversations(params?: {
  page?: number;
  folder?: InboxFolder;
  system_only?: 0 | 1;
  /** @deprecated use folder='archive' */
  include_archived?: true;
}): Promise<PaginatedResponse<Conversation>> {
  const { data } = await axiosInstance.get<PaginatedResponse<Conversation>>('/inbox/conversations', { params });
  return data;
}

export async function getSystemConversations(params?: { page?: number }): Promise<PaginatedResponse<Conversation>> {
  return getConversations({ ...params, folder: 'system' });
}

export async function getConversation(id: number): Promise<Conversation> {
  const { data } = await axiosInstance.get<ApiResponse<Conversation>>(`/inbox/conversations/${id}`);
  return data.data;
}

export async function createConversation(payload: NewConversationPayload): Promise<Conversation> {
  const { data } = await axiosInstance.post<ApiResponse<Conversation>>('/inbox/conversations', payload);
  return data.data;
}

export async function archiveConversation(id: number): Promise<void> {
  await axiosInstance.post(`/inbox/conversations/${id}/archive`);
}

export async function unarchiveConversation(id: number): Promise<void> {
  await axiosInstance.post(`/inbox/conversations/${id}/unarchive`);
}

export async function leaveConversation(id: number): Promise<void> {
  await axiosInstance.post(`/inbox/conversations/${id}/leave`);
}

export async function deleteConversation(id: number): Promise<void> {
  await axiosInstance.delete(`/inbox/conversations/${id}`);
}

/** Toggle starred state. Returns new is_starred value. */
export async function starConversation(id: number): Promise<boolean> {
  const { data } = await axiosInstance.post<{ is_starred: boolean }>(`/inbox/conversations/${id}/star`);
  return data.is_starred;
}

/** Toggle important state. Returns new is_important value. */
export async function markImportant(id: number): Promise<boolean> {
  const { data } = await axiosInstance.post<{ is_important: boolean }>(`/inbox/conversations/${id}/important`);
  return data.is_important;
}

/** Move to user's trash (per-user soft delete). */
export async function trashConversation(id: number): Promise<void> {
  await axiosInstance.post(`/inbox/conversations/${id}/trash`);
}

/** Restore from user's trash. */
export async function restoreConversation(id: number): Promise<void> {
  await axiosInstance.post(`/inbox/conversations/${id}/restore-trash`);
}

/** Mark all messages in a conversation as read for the current user. */
export async function markConversationAsRead(id: number): Promise<void> {
  await axiosInstance.post(`/inbox/conversations/${id}/read`);
}

/** Mark a conversation as unread (removes the latest read receipt) for the current user. */
export async function markConversationAsUnread(id: number): Promise<void> {
  await axiosInstance.post(`/inbox/conversations/${id}/unread`);
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export async function getMessages(conversationId: number, params?: { page?: number }): Promise<PaginatedResponse<Message>> {
  const { data } = await axiosInstance.get<PaginatedResponse<Message>>(
    `/inbox/conversations/${conversationId}/messages`,
    { params }
  );
  return data;
}

/**
 * Send a new message in a conversation.
 *
 * @param conversationId  Target conversation
 * @param body            HTML body
 * @param attachments     Optional files (triggers multipart upload)
 * @param recipients      Optional TO/CC/BCC entries. When sent with files, recipients are
 *                        serialised as a JSON string in `recipients_json` (FormData limitation).
 */
export async function sendMessage(
  conversationId: number,
  body: string,
  attachments?: File[],
  recipients?: RecipientEntry[],
  /** Client-generated UUID for idempotency — reuse the same key on retries to avoid duplicates. */
  idempotencyKey?: string,
): Promise<Message> {
  // Use a provided key or generate one; passing to the server ensures retries are safe
  const key = idempotencyKey ?? (typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

  if (attachments && attachments.length > 0) {
    const form = new FormData();
    form.append('body', body);
    form.append('idempotency_key', key);
    attachments.forEach((file) => form.append('attachments[]', file));
    if (recipients && recipients.length > 0) {
      // FormData cannot send nested objects, so serialise recipients as JSON string
      form.append('recipients_json', JSON.stringify(recipients));
    }
    const { data } = await axiosInstance.post<ApiResponse<Message>>(
      `/inbox/conversations/${conversationId}/messages`,
      form,
    );
    return data.data;
  }

  const payload: Record<string, unknown> = { body, idempotency_key: key };
  if (recipients && recipients.length > 0) {
    payload['recipients'] = recipients;
  }

  const { data } = await axiosInstance.post<ApiResponse<Message>>(
    `/inbox/conversations/${conversationId}/messages`,
    payload,
  );
  return data.data;
}

/**
 * Reply to a specific message, sending only to the original sender.
 *
 * Recipients are computed server-side — no recipient list needed from the client.
 */
export async function replyToMessage(
  conversationId: number,
  parentMessageId: number,
  body: string,
  attachments?: File[],
): Promise<Message> {
  if (attachments && attachments.length > 0) {
    const form = new FormData();
    form.append('body', body);
    form.append('parent_message_id', String(parentMessageId));
    attachments.forEach((file) => form.append('attachments[]', file));
    const { data } = await axiosInstance.post<ApiResponse<Message>>(
      `/inbox/conversations/${conversationId}/reply`,
      form,
    );
    return data.data;
  }

  const { data } = await axiosInstance.post<ApiResponse<Message>>(
    `/inbox/conversations/${conversationId}/reply`,
    { body, parent_message_id: parentMessageId },
  );
  return data.data;
}

/**
 * Reply All to a message — sends to original sender + all visible TO/CC recipients.
 *
 * BCC recipients from the original message are excluded by the server.
 * The server also excludes the current user from the recipient list.
 */
export async function replyAllToMessage(
  conversationId: number,
  parentMessageId: number,
  body: string,
  attachments?: File[],
): Promise<Message> {
  if (attachments && attachments.length > 0) {
    const form = new FormData();
    form.append('body', body);
    form.append('parent_message_id', String(parentMessageId));
    attachments.forEach((file) => form.append('attachments[]', file));
    const { data } = await axiosInstance.post<ApiResponse<Message>>(
      `/inbox/conversations/${conversationId}/reply-all`,
      form,
    );
    return data.data;
  }

  const { data } = await axiosInstance.post<ApiResponse<Message>>(
    `/inbox/conversations/${conversationId}/reply-all`,
    { body, parent_message_id: parentMessageId },
  );
  return data.data;
}

export async function getUnreadCount(): Promise<number> {
  const { data } = await axiosInstance.get<{ success: boolean; unread_count: number }>('/inbox/messages/unread-count');
  return data.unread_count ?? 0;
}

export async function searchInboxUsers(query: string): Promise<ConversationParticipant[]> {
  const { data } = await axiosInstance.get<ApiResponse<ConversationParticipant[]>>('/inbox/users', { params: { search: query } });
  return data.data;
}

export async function downloadAttachment(messageId: number, documentId: number, name: string): Promise<void> {
  const response = await axiosInstance.get(
    `/inbox/messages/${messageId}/attachments/${documentId}`,
    { responseType: 'blob' }
  );
  const url = URL.createObjectURL(response.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Fetch an attachment as a blob URL for inline preview. Caller is responsible for revoking it. */
export async function getAttachmentBlobUrl(messageId: number, documentId: number): Promise<string> {
  const response = await axiosInstance.get(
    `/inbox/messages/${messageId}/attachments/${documentId}/preview`,
    { responseType: 'blob' }
  );
  return URL.createObjectURL(response.data as Blob);
}
