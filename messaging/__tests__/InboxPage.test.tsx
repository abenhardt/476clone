/**
 * InboxPage.test.tsx
 *
 * Gmail interaction regression tests. Guards against:
 *   - Premature empty state rendering before data loads
 *   - Keyboard shortcuts (c = compose, / = focus search, Esc = close compose)
 *   - Bulk selection mode (count + clear button)
 *   - MessageRow hover-reveal action buttons
 *   - window.prompt/window.confirm absence (static audit)
 */

import { describe, test, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve, join } from 'path';

// ─── Static analysis guard: no native browser prompts ─────────────────────────

const MESSAGING_DIR = resolve(__dirname, '../');

function collectFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== '__tests__') {
      return collectFiles(fullPath);
    }
    if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
      return [fullPath];
    }
    return [];
  });
}

describe('window.prompt / window.confirm audit', () => {
  test('no window.prompt calls in messaging components', () => {
    const files = collectFiles(MESSAGING_DIR);
    const violations: string[] = [];

    files.forEach((filePath) => {
      const content = readFileSync(filePath, 'utf-8');
      // Match window.prompt( or standalone prompt( but not 'placeholder', 'promptText', etc.
      const promptMatches = content.match(/(?<![a-zA-Z])prompt\s*\(/g);
      const windowPromptMatches = content.match(/window\.prompt\s*\(/g);
      if (promptMatches || windowPromptMatches) {
        violations.push(filePath.replace(MESSAGING_DIR, ''));
      }
    });

    expect(violations, `Found window.prompt in: ${violations.join(', ')}`).toHaveLength(0);
  });

  test('no window.confirm calls in messaging components', () => {
    const files = collectFiles(MESSAGING_DIR);
    const violations: string[] = [];

    files.forEach((filePath) => {
      const content = readFileSync(filePath, 'utf-8');
      const confirmMatches = content.match(/window\.confirm\s*\(/g);
      if (confirmMatches) {
        violations.push(filePath.replace(MESSAGING_DIR, ''));
      }
    });

    expect(violations, `Found window.confirm in: ${violations.join(', ')}`).toHaveLength(0);
  });
});

// ─── InboxPage source structure guard ─────────────────────────────────────────

describe('InboxPage source structure', () => {
  const inboxSrc = readFileSync(resolve(__dirname, '../pages/InboxPage.tsx'), 'utf-8');

  test('uses useBootstrapReady hook', () => {
    expect(inboxSrc).toContain('useBootstrapReady');
  });

  test('uses CSS transition-based crossfade for list/thread pane', () => {
    // InboxPage uses CSS transitions (transition-all/transition-colors) rather than
    // Framer Motion AnimatePresence — ThreadView is rendered inline with CSS-based smooth transitions.
    expect(inboxSrc).toContain('ThreadView');
    expect(inboxSrc).toContain('transition');
  });

  test('uses keyboard shortcut for compose (c key)', () => {
    expect(inboxSrc).toContain("e.key === 'c'");
  });

  test('uses keyboard shortcut for search (/ key)', () => {
    expect(inboxSrc).toContain("e.key === '/'");
  });

  test('uses keyboard shortcut for escape (Esc key)', () => {
    expect(inboxSrc).toContain("e.key === 'Escape'");
  });

  test('uses scroll restoration with requestAnimationFrame', () => {
    expect(inboxSrc).toContain('requestAnimationFrame');
    // scroll ref is named savedScroll (was savedScrollPos in older draft)
    expect(inboxSrc).toContain('savedScroll');
  });

  test('bulk selection shows count and clear button', () => {
    expect(inboxSrc).toContain('selected.size} selected');
    expect(inboxSrc).toContain('Clear selection');
  });

  test('imports extracted MessageRow component', () => {
    expect(inboxSrc).toContain("from '@/features/messaging/components/MessageRow'");
  });

  test('imports extracted ThreadView component', () => {
    expect(inboxSrc).toContain("from '@/features/messaging/components/ThreadView'");
  });

  test('imports extracted FloatingCompose component', () => {
    expect(inboxSrc).toContain("from '@/features/messaging/components/FloatingCompose'");
  });
});

// ─── MessageRow source structure guard ────────────────────────────────────────

describe('MessageRow source structure', () => {
  const messageRowSrc = readFileSync(resolve(__dirname, '../components/MessageRow.tsx'), 'utf-8');

  test('renders archive button with data-testid', () => {
    expect(messageRowSrc).toContain('data-testid="row-archive-btn"');
  });

  test('renders delete button with data-testid', () => {
    expect(messageRowSrc).toContain('data-testid="row-delete-btn"');
  });

  test('renders more button with data-testid', () => {
    expect(messageRowSrc).toContain('data-testid="row-more-btn"');
  });

  test('uses group-hover opacity pattern for hover-reveal', () => {
    expect(messageRowSrc).toContain('group-hover:opacity-0');
    expect(messageRowSrc).toContain('group-hover:opacity-100');
  });

  test('has More menu with mark as read option', () => {
    expect(messageRowSrc).toContain('Mark as read');
  });

  test('has More menu with mark as unread option', () => {
    expect(messageRowSrc).toContain('Mark as unread');
  });
});

// ─── FloatingCompose source structure guard ───────────────────────────────────

describe('FloatingCompose source structure', () => {
  const composeSrc = readFileSync(resolve(__dirname, '../components/FloatingCompose.tsx'), 'utf-8');

  test('uses light neutral header (var(--card))', () => {
    expect(composeSrc).toContain("background: 'var(--card)'");
  });

  test('uses ConfirmDialog for close guard (no window.confirm calls)', () => {
    expect(composeSrc).toContain('ConfirmDialog');
    // Check for actual call site (with open paren), not just the word in comments
    expect(composeSrc).not.toMatch(/window\.confirm\s*\(/);
  });

  test('has SaveStatus type for draft autosave', () => {
    expect(composeSrc).toContain("type SaveStatus");
    expect(composeSrc).toContain("'saving'");
    expect(composeSrc).toContain("'saved'");
  });

  test('width is 560px not 440px', () => {
    expect(composeSrc).toContain('560');
    expect(composeSrc).not.toContain(': 440');
  });

  test('imports RichTextEditor component', () => {
    expect(composeSrc).toContain("from './editor/RichTextEditor'");
  });
});

// ─── ThreadView source structure guard ───────────────────────────────────────

describe('ThreadView source structure', () => {
  const threadSrc = readFileSync(resolve(__dirname, '../components/ThreadView.tsx'), 'utf-8');

  test('imports RichTextEditor (not inline implementation)', () => {
    expect(threadSrc).toContain("from './editor/RichTextEditor'");
  });

  test('does NOT have its own motion entry animation (parent handles crossfade)', () => {
    // ThreadView should not have initial={{ opacity: 0, x: ... }} — only parent wraps it
    expect(threadSrc).not.toMatch(/initial=\{\{.*x:/);
  });
});

// ─── Editor components source structure guard ─────────────────────────────────

describe('RichTextEditor source structure', () => {
  const editorSrc = readFileSync(resolve(__dirname, '../components/editor/RichTextEditor.tsx'), 'utf-8');

  test('no window.prompt in editor', () => {
    expect(editorSrc).not.toMatch(/(?<![a-zA-Z])prompt\s*\(/);
  });

  test('has Bold toolbar button', () => {
    expect(editorSrc).toContain("title=\"Bold\"");
  });

  test('has list toolbar buttons (no window.prompt for lists)', () => {
    expect(editorSrc).toContain("title=\"Bullet list\"");
    expect(editorSrc).toContain("title=\"Numbered list\"");
  });
});

// ─── Unread count system integrity guards ─────────────────────────────────────
//
// These static checks enforce the correct timing for the 'messaging:unread-changed'
// event. The event MUST be dispatched only AFTER the server operation completes —
// never before — to prevent ghost badge counts.

describe('unread count — event dispatch timing', () => {
  const inboxSrc    = readFileSync(resolve(__dirname, '../pages/InboxPage.tsx'), 'utf-8');
  const threadSrc   = readFileSync(resolve(__dirname, '../components/ThreadView.tsx'), 'utf-8');

  test('openConversation does NOT dispatch messaging:unread-changed (premature dispatch guard)', () => {
    // Extract the openConversation function body.
    // The event must NOT be dispatched (window.dispatchEvent) here — the server
    // hasn't written read receipts yet. Comments mentioning the event name are fine.
    const fnMatch = inboxSrc.match(/function openConversation[\s\S]*?^ {2}\}/m);
    expect(fnMatch, 'openConversation function not found').not.toBeNull();
    const fnBody = fnMatch![0];
    // Look for an actual dispatch call, not just the event name appearing in a comment.
    expect(fnBody).not.toMatch(/window\.dispatchEvent/);
  });

  test('ThreadView dispatches messaging:unread-changed inside getMessages .then() handler', () => {
    // The event must fire AFTER getMessages resolves — that is when the server has
    // committed the read receipts (auto-marked during the message list fetch).
    expect(threadSrc).toContain('messaging:unread-changed');
    // The dispatch must be inside the .then() callback, not before getMessages is called.
    const thenIdx = threadSrc.indexOf('.then((res) => {');
    const eventIdx = threadSrc.indexOf('messaging:unread-changed');
    expect(thenIdx).toBeGreaterThan(0);
    expect(eventIdx).toBeGreaterThan(thenIdx);
  });

  test('ThreadView guards event on hadUnread — never fires for already-read conversations', () => {
    // Fires only when the conversation actually had unread messages.
    expect(threadSrc).toContain('hadUnread');
    expect(threadSrc).toMatch(/hadUnread.*messaging:unread-changed|messaging:unread-changed.*hadUnread/s);
  });

  test('handleMarkRead dispatches event after successful API call', () => {
    // Event must come AFTER the await markConversationAsRead(id), not before.
    const markReadMatch = inboxSrc.match(/async function handleMarkRead[\s\S]*?^ {2}\}/m);
    expect(markReadMatch).not.toBeNull();
    const fnBody = markReadMatch![0];
    expect(fnBody).toContain('messaging:unread-changed');
    // The await must come before the dispatch.
    const awaitIdx    = fnBody.indexOf('await markConversationAsRead');
    const dispatchIdx = fnBody.indexOf('messaging:unread-changed');
    expect(awaitIdx).toBeGreaterThan(0);
    expect(dispatchIdx).toBeGreaterThan(awaitIdx);
  });

  test('handleBulkMarkRead dispatches event after API calls complete', () => {
    const bulkMatch = inboxSrc.match(/async function handleBulkMarkRead[\s\S]*?^ {2}\}/m);
    expect(bulkMatch).not.toBeNull();
    const fnBody = bulkMatch![0];
    expect(fnBody).toContain('messaging:unread-changed');
    const promiseIdx  = fnBody.indexOf('Promise.all');
    const dispatchIdx = fnBody.indexOf('messaging:unread-changed');
    expect(promiseIdx).toBeGreaterThan(0);
    expect(dispatchIdx).toBeGreaterThan(promiseIdx);
  });
});

describe('unread count — single source of truth (context)', () => {
  const UI_CONTEXT_DIR = resolve(__dirname, '../../../ui/context');
  const contextSrc = readFileSync(resolve(UI_CONTEXT_DIR, 'MessagingCountContext.tsx'), 'utf-8');
  const headerSrc  = readFileSync(resolve(__dirname, '../../../ui/layout/DashboardHeader.tsx'), 'utf-8');
  const adminSrc   = readFileSync(resolve(__dirname, '../../../ui/layout/AdminLayout.tsx'), 'utf-8');
  const superSrc   = readFileSync(resolve(__dirname, '../../../ui/layout/SuperAdminLayout.tsx'), 'utf-8');

  test('MessagingCountContext exports MessagingCountProvider and useUnreadMessageCount', () => {
    expect(contextSrc).toContain('export function MessagingCountProvider');
    expect(contextSrc).toContain('export function useUnreadMessageCount');
  });

  test('context has exactly ONE event listener for messaging:unread-changed', () => {
    const listenerCount = (contextSrc.match(/addEventListener.*messaging:unread-changed/g) ?? []).length;
    expect(listenerCount).toBe(1);
  });

  test('DashboardHeader consumes useUnreadMessageCount from context, not its own fetch', () => {
    expect(headerSrc).toContain('useUnreadMessageCount');
    // Must NOT independently call getUnreadCount — that would duplicate the fetch.
    expect(headerSrc).not.toContain("getUnreadCount()");
    expect(headerSrc).not.toContain("getUnreadMessageCount()");
  });

  test('AdminLayout consumes useUnreadMessageCount from context, not its own fetch', () => {
    expect(adminSrc).toContain('useUnreadMessageCount');
    expect(adminSrc).not.toContain("getUnreadCount()");
  });

  test('SuperAdminLayout consumes useUnreadMessageCount from context, not its own fetch', () => {
    expect(superSrc).toContain('useUnreadMessageCount');
    expect(superSrc).not.toContain("getUnreadCount()");
  });

  test('DashboardHeader uses meta.unread_count for notification bell (not local page filter)', () => {
    // Local filter: res.data.filter((n) => !n.read_at).length  — WRONG (paginated to 15)
    // Server count:  res.meta.unread_count                      — CORRECT
    expect(headerSrc).toContain('meta.unread_count');
    expect(headerSrc).not.toMatch(/\.data\.filter.*read_at/);
  });
});

describe('unread count — badge visibility rules', () => {
  const sidebarSrc = readFileSync(resolve(__dirname, '../../../ui/layout/DashboardSidebar.tsx'), 'utf-8');
  const headerSrc  = readFileSync(resolve(__dirname, '../../../ui/layout/DashboardHeader.tsx'), 'utf-8');

  test('sidebar badge only renders when badge > 0', () => {
    // The badge pill must be conditional on a positive value.
    expect(sidebarSrc).toMatch(/item\.badge.*>\s*0|item\.badge\s*!=.*null.*item\.badge\s*>/);
  });

  test('bell badge dot only renders when unreadCount > 0', () => {
    expect(headerSrc).toMatch(/unreadCount\s*>\s*0/);
  });

  test('bell unreadCount is a sum of both notification and message counts', () => {
    expect(headerSrc).toContain('unreadNotifications + unreadMessageCount');
  });
});
