// snippet: feedback-toast
// category: feedback
// rationale: components/feedback.md
// requires: tailwindcss

import { useState, useEffect, useCallback, memo } from 'react';

const STATS = [
  { label: 'Total Revenue',   value: '$48,295', delta: '12.5%', positive: true },
  { label: 'Active Users',    value: '2,847',   delta: '8.2%',  positive: true },
  { label: 'Bounce Rate',     value: '24.3%',   delta: '3.1%',  positive: false },
  { label: 'Conversion Rate', value: '3.24%',   delta: '1.8%',  positive: true },
];

const UP_PATH   = 'M10 17a.75.75 0 0 1-.75-.75V5.612L5.29 9.77a.75.75 0 0 1-1.08-1.04l5.25-5.5a.75.75 0 0 1 1.08 0l5.25 5.5a.75.75 0 1 1-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0 1 10 17Z';
const DOWN_PATH = 'M10 3a.75.75 0 0 1 .75.75v10.638l3.96-4.158a.75.75 0 1 1 1.08 1.04l-5.25 5.5a.75.75 0 0 1-1.08 0l-5.25-5.5a.75.75 0 1 1 1.08-1.04l3.96 4.158V3.75A.75.75 0 0 1 10 3Z';

const TOAST_VARIANTS = {
  success: {
    bg: 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800',
    icon: 'text-green-600 dark:text-green-400',
    text: 'text-green-800 dark:text-green-300',
    path: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  error: {
    bg: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800',
    icon: 'text-red-600 dark:text-red-400',
    text: 'text-red-800 dark:text-red-300',
    path: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800',
    icon: 'text-amber-600 dark:text-amber-400',
    text: 'text-amber-800 dark:text-amber-300',
    path: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
    icon: 'text-blue-600 dark:text-blue-400',
    text: 'text-blue-800 dark:text-blue-300',
    path: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
};

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, variant = 'info', duration = 5000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, variant, duration }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}

export function ToastContainer({ toasts, onDismiss }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none" aria-live="polite">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

const Toast = memo(function Toast({ id, message, variant = 'info', duration = 5000, onDismiss }) {
  const v = TOAST_VARIANTS[variant] || TOAST_VARIANTS.info;

  useEffect(() => {
    if (duration <= 0) return;
    const timer = setTimeout(() => onDismiss(id), duration);
    return () => clearTimeout(timer);
  }, [duration, id, onDismiss]);

  return (
    <div className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg ${v.bg} animate-in slide-in-from-right`} role="alert">
      <svg className={`w-5 h-5 shrink-0 mt-0.5 ${v.icon}`} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d={v.path} />
      </svg>
      <p className={`text-sm font-medium flex-1 ${v.text}`}>{message}</p>
      <button
        onClick={() => onDismiss(id)}
        className={`shrink-0 p-0.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${v.icon}`}
        aria-label="Dismiss notification"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg>
      </button>
    </div>
  );
});

export default function StatsRow() {
  const { toasts, addToast, removeToast } = useToast();

  return (
    <div id="statsRowWrap" className="min-h-screen flex items-center justify-center p-8 bg-slate-50 dark:bg-slate-900">
      <main className="py-12 md:py-16 lg:py-20 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STATS.map((stat) => (
              <button
                key={stat.label}
                type="button"
                onClick={() => addToast(`${stat.label}: ${stat.value}`, stat.positive ? 'success' : 'warning')}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm text-left hover:shadow-md transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{stat.label}</p>
                <p className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{stat.value}</p>
                <div className="mt-3 flex items-center gap-1.5">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${stat.positive ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
                    <svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d={stat.positive ? UP_PATH : DOWN_PATH} clipRule="evenodd" />
                    </svg>
                    {stat.delta}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">vs last month</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
