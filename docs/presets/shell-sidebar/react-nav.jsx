// snippet: nav-sidebar
// category: navigation
// rationale: components/navigation.md
// requires: tailwindcss

import { useState } from 'react';

const navSections = [
  {
    label: 'Main',
    items: [
      {
        id: 'dashboard',
        name: 'Dashboard',
        href: '#',
        icon: (
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
        ),
      },
      {
        id: 'analytics',
        name: 'Analytics',
        href: '#',
        icon: (
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path d="M9 19v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6m6 0h6m-6 0V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v10m6 0v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
          </svg>
        ),
      },
      {
        id: 'customers',
        name: 'Customers',
        href: '#',
        icon: (
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
          </svg>
        ),
      },
    ],
  },
  {
    label: 'Management',
    items: [
      {
        id: 'products',
        name: 'Products',
        href: '#',
        icon: (
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        ),
      },
      {
        id: 'orders',
        name: 'Orders',
        href: '#',
        icon: (
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2" />
          </svg>
        ),
      },
    ],
  },
];

export function NavSidebar({ activeItem = 'dashboard', onNavigate }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`${
        collapsed ? 'w-14' : 'w-60'
      } bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col h-screen sticky top-0 transition-[width] duration-200`}
    >
      {/* Header with collapse toggle */}
      <div className="h-16 flex items-center justify-between px-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
        {!collapsed && (
          <span className="text-lg font-bold text-slate-900 dark:text-white pl-3 truncate">
            AppName
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg min-h-11 min-w-11 flex items-center justify-center"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            {collapsed ? (
              <path d="M9 18l6-6-6-6" />
            ) : (
              <path d="M15 18l-6-6 6-6" />
            )}
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2" aria-label="Main navigation">
        {navSections.map((section) => (
          <div key={section.label} className="mb-4">
            {!collapsed && (
              <p className="px-3 mb-2 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {section.label}
              </p>
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive = activeItem === item.id;
                return (
                  <a
                    key={item.id}
                    href={item.href}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate?.(item.id);
                    }}
                    className={`flex items-center ${
                      collapsed ? 'justify-center' : 'gap-3'
                    } px-3 py-2.5 text-sm font-semibold rounded-lg transition-colors min-h-11 ${
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                    title={collapsed ? item.name : undefined}
                  >
                    {item.icon}
                    {!collapsed && item.name}
                  </a>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-slate-200 dark:border-slate-700 shrink-0">
        <a
          href="#"
          className={`flex items-center ${
            collapsed ? 'justify-center' : 'gap-3'
          } px-3 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors min-h-11`}
          title={collapsed ? 'Settings' : undefined}
        >
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
          {!collapsed && 'Settings'}
        </a>
        {/* User */}
        <div
          className={`flex items-center ${
            collapsed ? 'justify-center' : 'gap-3'
          } px-3 py-2.5 mt-1`}
        >
          <div className="w-8 h-8 bg-blue-700 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0">
            JD
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">Jane Doe</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">jane@example.com</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
