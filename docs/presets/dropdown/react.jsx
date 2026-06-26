// snippet: nav-dropdown
// category: navigation
// rationale: components/navigation.md
// requires: tailwindcss

import { useState, useEffect, useRef, useCallback, Fragment } from 'react';

const defaultItems = [
  { id: 'edit', label: 'Edit', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
  { id: 'duplicate', label: 'Duplicate', icon: 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z' },
  { id: 'archive', label: 'Archive', icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4' },
  { type: 'separator' },
  { id: 'share', label: 'Share', icon: 'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z' },
  { id: 'favorite', label: 'Favorite', icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' },
  { type: 'separator' },
  { id: 'delete', label: 'Delete', icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16', destructive: true },
];

export function DropdownMenu({ items = defaultItems, label = 'Options', onSelect, triggerId = 'dropdown-trigger' }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const menuRef = useRef(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) close();
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, close]);

  useEffect(() => {
    if (!open || !menuRef.current) return;
    const firstItem = menuRef.current.querySelector('[role="menuitem"]');
    if (firstItem) firstItem.focus();
  }, [open]);

  const handleMenuKeyDown = (e) => {
    const menuItems = menuRef.current ? [...menuRef.current.querySelectorAll('[role="menuitem"]')] : [];
    const idx = menuItems.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); menuItems[(idx + 1) % menuItems.length]?.focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); menuItems[(idx - 1 + menuItems.length) % menuItems.length]?.focus(); }
  };

  // Group items between separators so each group gets a py-1 wrapper
  const groups = items.reduce((acc, item) => {
    if (item.type === 'separator') { acc.push([]); }
    else {
      if (!acc.length) acc.push([]);
      acc[acc.length - 1].push(item);
    }
    return acc;
  }, []);

  return (
    <div className="static sm:relative inline-block text-left" ref={wrapperRef}>
      <button
        type="button"
        id={triggerId}
        className="inline-flex items-center gap-2 min-h-11 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {label}
        <svg className="w-4 h-4 text-blue-700 dark:text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" /></svg>
      </button>

      {open && (
        <div
          className="absolute left-4 right-4 sm:left-auto sm:right-0 z-50 mt-2 sm:w-56 origin-top-left sm:origin-top-right rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg ring-1 ring-blue-500/10"
          role="menu"
          aria-orientation="vertical"
          aria-labelledby={triggerId}
          ref={menuRef}
          onKeyDown={handleMenuKeyDown}
        >
          {groups.map((group, gi) => (
            <Fragment key={gi}>
              {gi > 0 && <div className="border-t border-slate-200 dark:border-slate-700" />}
              <div className="py-1">
                {group.map(item => (
                  <MenuItem key={item.id} item={item} onSelect={onSelect} close={close} />
                ))}
              </div>
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

function MenuItem({ item, onSelect, close }) {
  return (
    <button
      role="menuitem"
      tabIndex={-1}
      className={`flex items-center gap-3 w-full min-h-11 px-4 py-2.5 text-sm text-left focus:outline-none transition-colors ${
        item.destructive
          ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 focus:bg-red-50 dark:focus:bg-red-900/20'
          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 focus:bg-blue-50 dark:focus:bg-blue-900/30 focus:[&>svg]:text-blue-600 dark:focus:[&>svg]:text-blue-400'
      }`}
      onClick={() => { onSelect?.(item.id); close(); }}
    >
      <svg className={`w-4 h-4 ${item.destructive ? '' : 'text-slate-600'}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d={item.icon} />
      </svg>
      {item.label}
    </button>
  );
}
