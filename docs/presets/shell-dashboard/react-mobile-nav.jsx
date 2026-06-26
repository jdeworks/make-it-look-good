// snippet: nav-bottom-mobile
// category: navigation
// rationale: components/navigation.md
// requires: tailwindcss

import { useState } from 'react';

const navItems = [
  { id: 'overview', label: 'Overview' },
  { id: 'reports', label: 'Reports' },
  { id: 'customers', label: 'Customers' },
  { id: 'products', label: 'Products' },
  { id: 'settings', label: 'Settings' },
];

function NavIcon({ id, className = 'w-5 h-5 shrink-0' }) {
  switch (id) {
    case 'overview':
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
      );
    case 'reports':
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path d="M9 19v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6m6 0h6m-6 0V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v10m6 0v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/>
        </svg>
      );
    case 'customers':
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        </svg>
      );
    case 'products':
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
        </svg>
      );
    case 'settings':
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
        </svg>
      );
    default:
      return null;
  }
}

export function ShellDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activePage, setActivePage] = useState('overview');

  function openSidebar() { setSidebarOpen(true); }
  function closeSidebar() { setSidebarOpen(false); }
  function navigate(id) { setActivePage(id); closeSidebar(); }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">

      {/* Sidebar overlay (mobile) */}
      <div
        className={`fixed inset-0 bg-slate-900/50 z-20 lg:hidden${sidebarOpen ? '' : ' hidden'}`}
        onClick={closeSidebar}
        aria-hidden={!sidebarOpen}
      />

      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className={`fixed inset-y-0 left-0 lg:static w-60 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex-col z-30${sidebarOpen ? ' flex' : ' hidden'} lg:flex`}>
          <div className="h-16 flex items-center px-6 border-b border-slate-200 dark:border-slate-700 shrink-0">
            <span className="text-xl font-semibold text-slate-900 dark:text-white">Analytics</span>
          </div>
          <nav className="flex-1 overflow-y-auto p-4 space-y-1" aria-label="Main navigation">
            {navItems.map((item) => {
              const isActive = activePage === item.id;
              return (
                <a
                  key={item.id}
                  href="#"
                  className={`flex min-h-11 items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none${
                    isActive
                      ? ' bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-200'
                      : ' text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white transition-colors'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={(e) => { e.preventDefault(); navigate(item.id); }}
                >
                  <NavIcon id={item.id} />
                  {item.label}
                </a>
              );
            })}
          </nav>
        </aside>

        {/* Main wrapper */}
        <div className="flex-1 flex flex-col min-h-screen min-w-0">

          {/* Top bar */}
          <header className="h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-10">
            <button
              className="lg:hidden p-2 -ml-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg min-h-11 min-w-11 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
              onClick={openSidebar}
              aria-label="Open menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
            </button>
            <div className="hidden sm:flex items-center flex-1 max-w-md">
              <div className="relative w-full">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-700 dark:text-slate-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                <input type="search" autoComplete="off" aria-label="Search" placeholder="Search..." className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-600 dark:placeholder-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none min-h-11" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg min-h-11 min-w-11 relative focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none" aria-label="Notifications">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" aria-hidden="true"></span>
              </button>
              <div className="w-8 h-8 bg-blue-700 rounded-full flex items-center justify-center text-white text-sm font-medium" aria-label="User: JD">JD</div>
            </div>
          </header>

          {/* Dashboard content */}
          <main className="flex-1 p-4 pb-20 lg:p-8">
            <div className="max-w-7xl">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
                <div>
                  <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Overview</h1>
                  <p className="text-base text-slate-700 dark:text-slate-300 mt-1">Your business at a glance</p>
                </div>
                <button className="mt-4 sm:mt-0 bg-blue-700 hover:bg-blue-800 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors min-h-11 inline-flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 5v14m-7-7h14"/></svg>
                  New Report
                </button>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Revenue</p>
                  <p className="text-2xl font-semibold text-slate-900 dark:text-white mt-1">$48,352</p>
                  <p className="text-sm mt-2 flex items-center gap-1">
                    <span className="text-green-700 dark:text-green-300 flex items-center gap-0.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M7 17l5-5 5 5"/></svg>
                      +12.5%
                    </span>
                    <span className="text-slate-700 dark:text-slate-300">vs last month</span>
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Customers</p>
                  <p className="text-2xl font-semibold text-slate-900 dark:text-white mt-1">2,431</p>
                  <p className="text-sm mt-2 flex items-center gap-1">
                    <span className="text-green-700 dark:text-green-300 flex items-center gap-0.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M7 17l5-5 5 5"/></svg>
                      +8.2%
                    </span>
                    <span className="text-slate-700 dark:text-slate-300">vs last month</span>
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Orders</p>
                  <p className="text-2xl font-semibold text-slate-900 dark:text-white mt-1">1,087</p>
                  <p className="text-sm mt-2 flex items-center gap-1">
                    <span className="text-red-700 dark:text-red-300 flex items-center gap-0.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 7l-5 5-5-5"/></svg>
                      -3.1%
                    </span>
                    <span className="text-slate-700 dark:text-slate-300">vs last month</span>
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Conversion</p>
                  <p className="text-2xl font-semibold text-slate-900 dark:text-white mt-1">3.6%</p>
                  <p className="text-sm mt-2 flex items-center gap-1">
                    <span className="text-green-700 dark:text-green-300 flex items-center gap-0.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M7 17l5-5 5 5"/></svg>
                      +0.8%
                    </span>
                    <span className="text-slate-700 dark:text-slate-300">vs last month</span>
                  </p>
                </div>
              </div>

              {/* Recent Orders Table */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="px-5 py-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Recent Orders</h2>
                  <a href="#" className="text-sm text-blue-700 dark:text-blue-300 hover:underline font-medium focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none rounded">View all</a>
                </div>
                {/* Mobile card layout */}
                <div className="grid gap-3 p-4 sm:hidden">
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">#3210</p>
                        <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">Sarah Chen</p>
                      </div>
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">$240.00</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200">Completed</span>
                      <span className="text-sm text-slate-700 dark:text-slate-300">Mar 15, 2026</span>
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">#3209</p>
                        <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">James Wilson</p>
                      </div>
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">$125.50</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200">Pending</span>
                      <span className="text-sm text-slate-700 dark:text-slate-300">Mar 15, 2026</span>
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">#3208</p>
                        <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">Maria Garcia</p>
                      </div>
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">$89.99</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200">Completed</span>
                      <span className="text-sm text-slate-700 dark:text-slate-300">Mar 14, 2026</span>
                    </div>
                  </div>
                </div>
                {/* Desktop table */}
                <div className="hidden overflow-x-auto sm:block">
                  <table className="w-full">
                    <caption className="sr-only">Recent orders list</caption>
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                        <th className="text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider px-6 py-3" scope="col">Order</th>
                        <th className="text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider px-6 py-3" scope="col">Customer</th>
                        <th className="text-right text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider px-6 py-3" scope="col">Amount</th>
                        <th className="text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider px-6 py-3" scope="col">Status</th>
                        <th className="text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider px-6 py-3" scope="col">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">#3210</td>
                        <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">Sarah Chen</td>
                        <td className="px-6 py-4 text-sm text-slate-900 dark:text-white text-right font-medium">$240.00</td>
                        <td className="px-6 py-4"><span className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200">Completed</span></td>
                        <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">Mar 15, 2026</td>
                      </tr>
                      <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">#3209</td>
                        <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">James Wilson</td>
                        <td className="px-6 py-4 text-sm text-slate-900 dark:text-white text-right font-medium">$125.50</td>
                        <td className="px-6 py-4"><span className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200">Pending</span></td>
                        <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">Mar 15, 2026</td>
                      </tr>
                      <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">#3208</td>
                        <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">Maria Garcia</td>
                        <td className="px-6 py-4 text-sm text-slate-900 dark:text-white text-right font-medium">$89.99</td>
                        <td className="px-6 py-4"><span className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200">Completed</span></td>
                        <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">Mar 14, 2026</td>
                      </tr>
                      <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">#3207</td>
                        <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">Alex Thompson</td>
                        <td className="px-6 py-4 text-sm text-slate-900 dark:text-white text-right font-medium">$312.00</td>
                        <td className="px-6 py-4"><span className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-200">Cancelled</span></td>
                        <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">Mar 14, 2026</td>
                      </tr>
                      <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">#3206</td>
                        <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">Priya Patel</td>
                        <td className="px-6 py-4 text-sm text-slate-900 dark:text-white text-right font-medium">$67.25</td>
                        <td className="px-6 py-4"><span className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200">Completed</span></td>
                        <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">Mar 13, 2026</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Mobile bottom nav — lg:hidden */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 safe-area-bottom lg:hidden"
        aria-label="Bottom navigation"
      >
        <div className="flex items-center justify-around">
          {navItems.map((item) => {
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={`flex flex-col items-center justify-center gap-1 py-2 px-1 min-h-14 min-w-14 flex-1 transition-colors${
                  isActive
                    ? ' text-blue-600 dark:text-blue-400'
                    : ' text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
                aria-current={isActive ? 'page' : undefined}
                aria-label={item.label}
              >
                <NavIcon id={item.id} className="w-6 h-6" />
                <span className="text-[10px] font-medium leading-tight">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
