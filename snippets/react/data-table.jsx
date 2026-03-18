// snippet: data-table
// category: data-display
// rationale: components/tables-and-lists.md
// requires: tailwindcss

import { useState, useMemo } from 'react';

const initialData = [
  { id: '#3210', customer: 'Sarah Chen', amount: 240.00, status: 'Completed', date: '2026-03-15' },
  { id: '#3209', customer: 'James Wilson', amount: 125.50, status: 'Pending', date: '2026-03-15' },
  { id: '#3208', customer: 'Maria Garcia', amount: 89.99, status: 'Completed', date: '2026-03-14' },
  { id: '#3207', customer: 'Alex Thompson', amount: 312.00, status: 'Cancelled', date: '2026-03-14' },
  { id: '#3206', customer: 'Priya Patel', amount: 67.25, status: 'Completed', date: '2026-03-13' },
];

const statusStyles = {
  Completed: 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  Pending: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  Cancelled: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400',
};

export function DataTable({ data = initialData }) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [filter, setFilter] = useState('');

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const filtered = useMemo(() => {
    let rows = data;
    if (filter) {
      const q = filter.toLowerCase();
      rows = rows.filter(
        (r) => r.customer.toLowerCase().includes(q) || r.id.includes(q)
      );
    }
    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return rows;
  }, [data, filter, sortKey, sortDir]);

  const SortIcon = ({ column }) => (
    <svg
      className={`w-4 h-4 inline-block ml-1 ${sortKey === column ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}
      fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
    >
      {sortKey === column && sortDir === 'desc'
        ? <path d="M17 7l-5 5-5-5" />
        : <path d="M7 17l5-5 5 5" />
      }
    </svg>
  );

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Orders</h2>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
          <input
            type="search"
            placeholder="Filter orders..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-10 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none min-h-11 w-full sm:w-64"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
              <th className="text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-6 py-3 cursor-pointer select-none" onClick={() => handleSort('id')}>
                Order <SortIcon column="id" />
              </th>
              <th className="text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-6 py-3 cursor-pointer select-none" onClick={() => handleSort('customer')}>
                Customer <SortIcon column="customer" />
              </th>
              <th className="text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-6 py-3 cursor-pointer select-none" onClick={() => handleSort('amount')}>
                Amount <SortIcon column="amount" />
              </th>
              <th className="text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-6 py-3 cursor-pointer select-none" onClick={() => handleSort('status')}>
                Status <SortIcon column="status" />
              </th>
              <th className="text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-6 py-3 cursor-pointer select-none" onClick={() => handleSort('date')}>
                Date <SortIcon column="date" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {filtered.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">{row.id}</td>
                <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">{row.customer}</td>
                <td className="px-6 py-4 text-sm text-slate-900 dark:text-white text-right font-medium">${row.amount.toFixed(2)}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles[row.status]}`}>
                    {row.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                  {new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                  No orders found matching "{filter}"
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
