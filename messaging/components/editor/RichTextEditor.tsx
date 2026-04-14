/**
 * RichTextEditor.tsx
 *
 * Reusable TipTap rich-text editor — exported as composable pieces for flexible layouts:
 *
 *   useRichEditor(opts)  — creates and returns the TipTap Editor instance
 *   EditorBody           — renders just the editable content area + placeholder styles
 *   EditorToolbar        — renders formatting buttons (Bold, Italic, Underline, lists)
 *   RichTextEditor       — combined wrapper (toolbar on top) for reply-box use in ThreadView
 *
 * FloatingCompose uses useRichEditor + EditorBody + EditorToolbar separately so the
 * toolbar lives in the footer bar (Gmail-style, bottom of compose panel).
 * onMouseDown preventDefault on toolbar buttons preserves editor selection.
 */

import { type ElementType } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, UnderlineIcon, List, ListOrdered } from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const BRAND   = '#16a34a';
const BRAND_T = 'rgba(22,163,74,0.10)';

// Rendered once per EditorBody instance — idempotent CSS
const TIPTAP_STYLES = `
  .tiptap p.is-editor-empty:first-child::before {
    color: var(--muted-foreground);
    content: attr(data-placeholder);
    float: left;
    height: 0;
    pointer-events: none;
  }
  .tiptap { outline: none; }
  .tiptap a { color: ${BRAND}; text-decoration: underline; }
  .tiptap ul { padding-left: 1.4rem; list-style-type: disc; }
  .tiptap ol { padding-left: 1.4rem; list-style-type: decimal; }
  .tiptap li + li { margin-top: 0.15rem; }
`;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RichEditorOptions {
  onUpdate: (html: string) => void;
  placeholder?: string;
  initialHtml?: string;
}

export interface RichTextEditorProps extends RichEditorOptions {
  minHeight?: number;
  maxHeight?: number;
}

// ─── useRichEditor ────────────────────────────────────────────────────────────

// eslint-disable-next-line react-refresh/only-export-components
export function useRichEditor({
  onUpdate,
  placeholder = 'Write a message…',
  initialHtml = '',
}: RichEditorOptions): Editor | null {
  return useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        // Only allow https, http, and mailto — blocks javascript:, vbscript:, data: URIs
        protocols: ['https', 'http', 'mailto'],
        HTMLAttributes: {
          // Default rel for all links — prevents target page from accessing window.opener
          rel: 'noopener noreferrer',
        },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: initialHtml,
    onUpdate: ({ editor: e }) => onUpdate(e.getHTML()),
  });
}

// ─── ToolbarButton ────────────────────────────────────────────────────────────

function ToolbarButton({
  onClick,
  active,
  disabled,
  icon: Icon,
  title,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  icon: ElementType;
  title: string;
}) {
  return (
    <button
      type="button"
      // onMouseDown preventDefault keeps editor selection intact when clicking toolbar
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
      className="p-1.5 rounded-md transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-default"
      style={{
        background: active ? BRAND_T : 'transparent',
        color: active ? BRAND : 'var(--muted-foreground)',
      }}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

// ─── EditorBody ───────────────────────────────────────────────────────────────
//
// Renders only the editable TipTap content area. Place this wherever the
// writing surface should appear in your layout.

export function EditorBody({
  editor,
  minHeight = 100,
  maxHeight,
  className = '',
}: {
  editor: Editor | null;
  minHeight?: number;
  maxHeight?: number;
  className?: string;
}) {
  if (!editor) return null;
  return (
    <>
      <div
        style={{
          minHeight,
          maxHeight,
          overflowY: maxHeight ? 'auto' : undefined,
        }}
      >
        <EditorContent
          editor={editor}
          className={`text-sm outline-none ${className}`}
          style={{ color: 'var(--foreground)' }}
        />
      </div>
      <style>{TIPTAP_STYLES}</style>
    </>
  );
}

// ─── EditorToolbar ────────────────────────────────────────────────────────────
//
// Self-contained toolbar: manages its own popover open/close state and
// anchor refs for Link and Emoji. Place this anywhere in the layout —
// the popovers are portal-rendered so placement is irrelevant.

export function EditorToolbar({
  editor,
  className = '',
}: {
  editor: Editor | null;
  className?: string;
}) {
  if (!editor) return null;

  return (
    <div className={`flex items-center gap-0.5 flex-wrap ${className}`}>
      <ToolbarButton
        icon={Bold}
        title="Bold"
        active={editor.isActive('bold')}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        icon={Italic}
        title="Italic"
        active={editor.isActive('italic')}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        icon={UnderlineIcon}
        title="Underline"
        active={editor.isActive('underline')}
        disabled={!editor.can().chain().focus().toggleUnderline().run()}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      />

      <div className="w-px h-4 mx-0.5 flex-shrink-0" style={{ background: 'var(--border)' }} />

      <ToolbarButton
        icon={List}
        title="Bullet list"
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        icon={ListOrdered}
        title="Numbered list"
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
    </div>
  );
}

// ─── RichTextEditor (combined, toolbar on top) ────────────────────────────────
//
// Drop-in combined component used by ThreadView reply boxes.
// Toolbar sits above the editor area.

export function RichTextEditor({
  onUpdate,
  placeholder = 'Write a message…',
  initialHtml = '',
  minHeight = 100,
  maxHeight,
}: RichTextEditorProps) {
  const editor = useRichEditor({ onUpdate, placeholder, initialHtml });

  if (!editor) return null;

  return (
    <div className="flex flex-col" style={{ minHeight }}>
      <EditorToolbar
        editor={editor}
        className="px-2 py-1 border-b"
      />
      <EditorBody
        editor={editor}
        minHeight={minHeight}
        maxHeight={maxHeight}
        className="flex-1 px-3 py-2"
      />
    </div>
  );
}
