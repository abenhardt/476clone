/**
 * LinkPopover.tsx
 *
 * Controlled popover for link insertion in the rich-text editor.
 * Replaces window.prompt entirely — no native browser dialogs.
 *
 * Uses proper TipTap editor APIs (no innerHTML/insertContent HTML string hacks):
 *   - setLink({ href }) for selected text
 *   - insertContent({ type: 'text', marks: [{ type: 'link' }] }) for empty selection
 */

import { useEffect, useRef, useState, type RefObject, type KeyboardEvent } from 'react';
import type { Editor } from '@tiptap/react';
import { Popover } from '@/ui/overlay/Popover';

interface LinkPopoverProps {
  editor: Editor | null;
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLButtonElement | null>;
}

export function LinkPopover({ editor, open, onClose, anchorRef }: LinkPopoverProps) {
  const [href, setHref] = useState('');
  const [displayText, setDisplayText] = useState('');
  const urlInputRef = useRef<HTMLInputElement>(null);

  // Pre-fill display text from current editor selection when popover opens
  useEffect(() => {
    if (open && editor) {
      const { from, to, empty } = editor.state.selection;
      if (!empty) {
        const selectedText = editor.state.doc.textBetween(from, to, ' ');
        setDisplayText(selectedText);
      } else {
        setDisplayText('');
      }
      setHref('');
      // Auto-focus the URL input
      setTimeout(() => urlInputRef.current?.focus(), 50);
    }
  }, [open, editor]);

  function handleInsert() {
    if (!editor || !href.trim()) return;

    const rawHref = href.trim();
    // Block javascript: protocol — it can execute arbitrary code when clicked.
    // Also block vbscript: and data: URIs which are similarly dangerous.
    const lowerHref = rawHref.toLowerCase();
    if (
      lowerHref.startsWith('javascript:') ||
      lowerHref.startsWith('vbscript:') ||
      lowerHref.startsWith('data:')
    ) {
      return;
    }
    const cleanHref = rawHref.startsWith('http') ? rawHref : `https://${rawHref}`;

    if (editor.state.selection.empty) {
      // No text selected: insert a new text node with the link mark
      // Using TipTap JSON format — type-safe, no HTML strings
      editor.chain().focus().insertContent({
        type: 'text',
        text: displayText.trim() || cleanHref,
        marks: [
          {
            type: 'link',
            attrs: { href: cleanHref, target: '_blank', rel: 'noopener noreferrer' },
          },
        ],
      }).run();
    } else {
      // Text is selected: apply link mark to the selection
      editor.chain().focus().setLink({
        href: cleanHref,
        target: '_blank',
      }).run();
    }

    setHref('');
    setDisplayText('');
    onClose();
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleInsert();
    }
  }

  return (
    <Popover open={open} onClose={onClose} anchorRef={anchorRef} placement="bottom-left">
      <div className="p-3 w-72 flex flex-col gap-2">
        <p className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
          Insert Link
        </p>

        {/* URL field */}
        <input
          ref={urlInputRef}
          type="url"
          value={href}
          onChange={(e) => setHref(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="https://example.com"
          className="w-full rounded-lg border px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-[var(--ember-orange)]/30"
          style={{
            background: 'var(--input)',
            borderColor: 'var(--border)',
            color: 'var(--foreground)',
          }}
        />

        {/* Display text field — only shown when selection is empty */}
        {editor?.state.selection.empty && (
          <input
            type="text"
            value={displayText}
            onChange={(e) => setDisplayText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Display text (optional)"
            className="w-full rounded-lg border px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-[var(--ember-orange)]/30"
            style={{
              background: 'var(--input)',
              borderColor: 'var(--border)',
              color: 'var(--foreground)',
            }}
          />
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleInsert}
            disabled={!href.trim()}
            className="text-xs px-3 py-1.5 rounded-lg text-white font-medium transition-opacity disabled:opacity-40"
            style={{ background: 'var(--ember-orange)' }}
          >
            Insert Link
          </button>
        </div>
      </div>
    </Popover>
  );
}
