/**
 * EmojiPicker.tsx
 *
 * Emoji picker dropdown for the rich-text editor.
 * No external emoji library — built-in set of ~72 common emojis.
 * No window.prompt — controlled React popover via Popover.tsx.
 */

import { useState, type RefObject } from 'react';
import type { Editor } from '@tiptap/react';
import { Popover } from '@/ui/overlay/Popover';

interface EmojiPickerProps {
  editor: Editor | null;
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLButtonElement | null>;
}

interface EmojiEntry {
  name: string;
  char: string;
}

const EMOJIS: EmojiEntry[] = [
  // Faces
  { name: 'smile',          char: '😊' },
  { name: 'laugh',          char: '😂' },
  { name: 'grin',           char: '😁' },
  { name: 'wink',           char: '😉' },
  { name: 'cool',           char: '😎' },
  { name: 'heart eyes',     char: '😍' },
  { name: 'thinking',       char: '🤔' },
  { name: 'neutral',        char: '😐' },
  { name: 'sad',            char: '😢' },
  { name: 'cry',            char: '😭' },
  { name: 'angry',          char: '😠' },
  { name: 'surprise',       char: '😮' },
  { name: 'party',          char: '🥳' },
  { name: 'nerd',           char: '🤓' },
  { name: 'hug',            char: '🤗' },
  { name: 'shrug',          char: '🤷' },
  // Gestures
  { name: 'thumbs up',      char: '👍' },
  { name: 'thumbs down',    char: '👎' },
  { name: 'ok hand',        char: '👌' },
  { name: 'wave',           char: '👋' },
  { name: 'clap',           char: '👏' },
  { name: 'pray',           char: '🙏' },
  { name: 'point right',    char: '👉' },
  { name: 'point up',       char: '☝️' },
  // Hearts
  { name: 'heart',          char: '❤️' },
  { name: 'green heart',    char: '💚' },
  { name: 'blue heart',     char: '💙' },
  { name: 'yellow heart',   char: '💛' },
  { name: 'broken heart',   char: '💔' },
  { name: 'sparkles',       char: '✨' },
  { name: 'fire',           char: '🔥' },
  { name: 'star',           char: '⭐' },
  // Objects
  { name: 'check',          char: '✅' },
  { name: 'x',              char: '❌' },
  { name: 'warning',        char: '⚠️' },
  { name: 'info',           char: 'ℹ️' },
  { name: 'bell',           char: '🔔' },
  { name: 'calendar',       char: '📅' },
  { name: 'email',          char: '📧' },
  { name: 'phone',          char: '📱' },
  { name: 'paperclip',      char: '📎' },
  { name: 'lock',           char: '🔒' },
  { name: 'key',            char: '🔑' },
  { name: 'link',           char: '🔗' },
  { name: 'search',         char: '🔍' },
  { name: 'pencil',         char: '✏️' },
  { name: 'document',       char: '📄' },
  { name: 'folder',         char: '📁' },
  { name: 'chart',          char: '📊' },
  { name: 'trophy',         char: '🏆' },
  { name: 'gift',           char: '🎁' },
  { name: 'pin',            char: '📌' },
  { name: 'flag',           char: '🚩' },
  // Nature
  { name: 'sun',            char: '☀️' },
  { name: 'rain',           char: '🌧️' },
  { name: 'tree',           char: '🌲' },
  { name: 'flower',         char: '🌸' },
  { name: 'wave ocean',     char: '🌊' },
  // Activities
  { name: 'tent camp',      char: '⛺' },
  { name: 'campfire',       char: '🔥' },
  { name: 'swimming',       char: '🏊' },
  { name: 'hiking',         char: '🥾' },
  { name: 'medical',        char: '🏥' },
  { name: 'stethoscope',    char: '🩺' },
  { name: 'children',       char: '👦' },
  { name: 'family',         char: '👨‍👩‍👧' },
  // Misc
  { name: 'tada',           char: '🎉' },
  { name: 'confetti',       char: '🎊' },
  { name: 'rocket',         char: '🚀' },
  { name: 'light bulb',     char: '💡' },
  { name: 'clock',          char: '⏰' },
  { name: 'money',          char: '💰' },
];

export function EmojiPicker({ editor, open, onClose, anchorRef }: EmojiPickerProps) {
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? EMOJIS.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()))
    : EMOJIS;

  function handleSelect(emoji: string) {
    if (editor) {
      editor.chain().focus().insertContent(emoji).run();
    }
    setSearch('');
    onClose();
  }

  return (
    <Popover open={open} onClose={onClose} anchorRef={anchorRef} placement="bottom-left">
      <div className="w-64 p-2 flex flex-col gap-2">
        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search emojis…"
          className="w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none"
          style={{
            background: 'var(--input)',
            borderColor: 'var(--border)',
            color: 'var(--foreground)',
          }}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
        />

        {/* Grid */}
        <div
          className="grid gap-0.5 overflow-y-auto"
          style={{ gridTemplateColumns: 'repeat(8, 1fr)', maxHeight: 180 }}
        >
          {filtered.length === 0 ? (
            <p className="col-span-8 text-center py-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>
              No results
            </p>
          ) : (
            filtered.map((emoji) => (
              <button
                key={emoji.char + emoji.name}
                type="button"
                title={emoji.name}
                onClick={() => handleSelect(emoji.char)}
                className="flex items-center justify-center w-7 h-7 rounded-lg text-base transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
              >
                {emoji.char}
              </button>
            ))
          )}
        </div>
      </div>
    </Popover>
  );
}
