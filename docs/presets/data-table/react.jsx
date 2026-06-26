// snippet: data-table
// category: data-display
// rationale: components/tables-and-lists.md
// requires: tailwindcss

// Avatar color classes — full strings kept as named consts for Tailwind JIT and sync-check visibility.
const scAvatarClass = 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300';
const jwAvatarClass = 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300';
const mgAvatarClass = 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300';
const atAvatarClass = 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300';
const ppAvatarClass = 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300';

// Status badge classes — full strings for Tailwind JIT.
const completedBadgeClass = 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-100';
const pendingBadgeClass = 'bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100';
const cancelledBadgeClass = 'bg-red-100 text-red-900 dark:bg-red-900/60 dark:text-red-100';

const statusBadgeClass = {
  Completed: completedBadgeClass,
  Pending: pendingBadgeClass,
  Cancelled: cancelledBadgeClass,
};

const orders = [
  { id: '#4721', initials: 'SC', avatarClass: scAvatarClass, name: 'Sarah Chen',    email: 'sarah.chen@email.com', amount: '$1,240.00', status: 'Completed', date: 'Mar 15, 2026' },
  { id: '#4720', initials: 'JW', avatarClass: jwAvatarClass, name: 'James Wilson',   email: 'j.wilson@email.com',   amount: '$856.50',   status: 'Pending',   date: 'Mar 15, 2026' },
  { id: '#4719', initials: 'MG', avatarClass: mgAvatarClass, name: 'Maria Garcia',   email: 'm.garcia@email.com',   amount: '$432.00',   status: 'Cancelled', date: 'Mar 14, 2026' },
  { id: '#4718', initials: 'AT', avatarClass: atAvatarClass, name: 'Alex Thompson',  email: 'alex.t@email.com',     amount: '$189.99',   status: 'Completed', date: 'Mar 13, 2026' },
  { id: '#4717', initials: 'PP', avatarClass: ppAvatarClass, name: 'Priya Patel',    email: 'priya.p@email.com',    amount: '$67.25',    status: 'Pending',   date: 'Mar 12, 2026' },
];

export function DataTable() {
  return (
    <main id="dataTableWrap" className="min-h-screen flex items-center justify-center p-4 md:p-6 lg:p-8 bg-slate-50 dark:bg-slate-900">
      <div className="w-full max-w-4xl">
        {/* Data Table: Sortable columns, status badges, hover rows */}
        <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700" aria-labelledby="orders-title">
          <header className="px-6 py-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <h1 id="orders-title" className="text-2xl font-semibold text-slate-900 dark:text-white">Orders</h1>
            <span className="text-sm text-slate-500 dark:text-slate-400">5 results</span>
          </header>
          <div className="overflow-x-auto min-w-0 max-w-full">
            <table className="w-full max-sm:block">
              <caption className="sr-only">Recent orders</caption>
              <thead className="max-sm:hidden">
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                  <th scope="col" className="text-left text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-2 py-3 md:px-4">
                    <button className="min-h-11 inline-flex items-center gap-1.5 hover:text-slate-700 dark:hover:text-slate-200 transition-colors group focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none" aria-label="Sort by Order number">
                      Order #
                      <svg className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-600 dark:group-hover:text-slate-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M8 9l4-4 4 4M16 15l-4 4-4-4"/></svg>
                    </button>
                  </th>
                  <th scope="col" className="text-left text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-2 py-3 md:px-4">
                    <button className="min-h-11 inline-flex items-center gap-1.5 hover:text-slate-700 dark:hover:text-slate-200 transition-colors group focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none" aria-label="Sort by Customer">
                      Customer
                      <svg className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-600 dark:group-hover:text-slate-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M8 9l4-4 4 4M16 15l-4 4-4-4"/></svg>
                    </button>
                  </th>
                  <th scope="col" className="text-right text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-2 py-3 md:px-4">
                    <button className="min-h-11 inline-flex items-center gap-1.5 hover:text-slate-700 dark:hover:text-slate-200 transition-colors group ml-auto focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none" aria-label="Sort by Amount, currently sorted descending">
                      Amount
                      {/* Active sort indicator (descending) */}
                      <svg className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M16 15l-4 4-4-4"/></svg>
                    </button>
                  </th>
                  <th scope="col" className="text-left text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-2 py-3 md:px-4">
                    <button className="min-h-11 inline-flex items-center gap-1.5 hover:text-slate-700 dark:hover:text-slate-200 transition-colors group focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none" aria-label="Sort by Status">
                      Status
                      <svg className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-600 dark:group-hover:text-slate-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M8 9l4-4 4 4M16 15l-4 4-4-4"/></svg>
                    </button>
                  </th>
                  <th scope="col" className="text-left text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-2 py-3 md:px-4">
                    <button className="min-h-11 inline-flex items-center gap-1.5 hover:text-slate-700 dark:hover:text-slate-200 transition-colors group focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none" aria-label="Sort by Date">
                      Date
                      <svg className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-600 dark:group-hover:text-slate-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M8 9l4-4 4 4M16 15l-4 4-4-4"/></svg>
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700 max-sm:divide-y-0">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors max-sm:block max-sm:w-full max-sm:my-3 max-sm:py-2 max-sm:rounded-xl max-sm:border max-sm:border-slate-200 dark:max-sm:border-slate-700">
                    <td data-label="Order #" className="px-2 py-4 md:px-4 text-sm font-medium text-slate-900 dark:text-white max-sm:flex max-sm:w-full max-sm:items-center max-sm:flex-wrap max-sm:justify-between max-sm:gap-4 max-sm:min-h-11 max-sm:text-right">
                      <span className="hidden max-sm:block text-sm font-semibold text-slate-700 dark:text-slate-300 text-left">Order #</span>
                      <span className="min-w-0 break-words">{order.id}</span>
                    </td>
                    <td data-label="Customer" className="px-2 py-4 md:px-4 max-sm:flex max-sm:w-full max-sm:items-center max-sm:flex-wrap max-sm:justify-between max-sm:gap-4 max-sm:min-h-11 max-sm:text-right">
                      <span className="hidden max-sm:block text-sm font-semibold text-slate-700 dark:text-slate-300 text-left">Customer</span>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0 ${order.avatarClass}`}>{order.initials}</div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-white">{order.name}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400 break-words">{order.email}</p>
                        </div>
                      </div>
                    </td>
                    <td data-label="Amount" className="px-2 py-4 md:px-4 text-sm text-slate-900 dark:text-white text-right font-medium tabular-nums max-sm:flex max-sm:w-full max-sm:items-center max-sm:flex-wrap max-sm:justify-between max-sm:gap-4 max-sm:min-h-11">
                      <span className="hidden max-sm:block text-sm font-semibold text-slate-700 dark:text-slate-300 text-left">Amount</span>
                      <span>{order.amount}</span>
                    </td>
                    <td data-label="Status" className="px-2 py-4 md:px-4 max-sm:flex max-sm:w-full max-sm:items-center max-sm:flex-wrap max-sm:justify-between max-sm:gap-4 max-sm:min-h-11 max-sm:text-right">
                      <span className="hidden max-sm:block text-sm font-semibold text-slate-700 dark:text-slate-300 text-left">Status</span>
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${statusBadgeClass[order.status]}`}>
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3"/></svg>
                        {order.status}
                      </span>
                    </td>
                    <td data-label="Date" className="px-2 py-4 md:px-4 text-sm text-slate-600 dark:text-slate-400 max-sm:flex max-sm:w-full max-sm:items-center max-sm:flex-wrap max-sm:justify-between max-sm:gap-4 max-sm:min-h-11 max-sm:text-right">
                      <span className="hidden max-sm:block text-sm font-semibold text-slate-700 dark:text-slate-300 text-left">Date</span>
                      <span>{order.date}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
