// snippet: form-search-bar
// category: forms
// rationale: components/forms.md
// requires: tailwindcss

import { useState, useRef, useEffect } from 'react';

export function HeroSearch({ onSearch, placeholder = 'Search...', filters = [] }) {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearch?.({ query, filter: activeFilter });
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, activeFilter]);

  const defaultFilters = filters.length > 0 ? filters : [
    { value: 'all', label: 'All' },
    { value: 'products', label: 'Products' },
    { value: 'users', label: 'Users' },
    { value: 'orders', label: 'Orders' },
  ];

  return (
    <div id="heroWrap" className="min-h-screen flex items-center justify-center p-8 bg-slate-50 dark:bg-slate-900">
      <main className="py-12 md:py-16 lg:py-20 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 dark:text-white">
              Ship better products,<br className="hidden sm:inline" /> faster than ever
            </h1>
            <p className="mt-6 text-lg sm:text-xl leading-8 text-slate-600 dark:text-slate-300">
              Streamline your workflow with powerful tools designed for modern teams.
              From idea to deployment in minutes, not months.
            </p>
            {/* Search bar replaces CTA buttons in this variant */}
            <div className="mt-10 relative flex items-center w-full max-w-2xl mx-auto">
              {/* Search icon */}
              <svg className="absolute left-3 w-5 h-5 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>

              {/* Input */}
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                className="w-full pl-11 pr-28 py-2.5 text-base bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none min-h-11"
              />

              {/* Filter dropdown */}
              <div className="absolute right-1.5">
                <button
                  onClick={() => setFilterOpen(!filterOpen)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors min-h-[36px]"
                  aria-expanded={filterOpen}
                  aria-haspopup="true"
                >
                  {defaultFilters.find(f => f.value === activeFilter)?.label}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
                </button>

                {filterOpen && (
                  <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 min-w-[140px] z-10">
                    {defaultFilters.map((f) => (
                      <button
                        key={f.value}
                        onClick={() => { setActiveFilter(f.value); setFilterOpen(false); }}
                        className={`block w-full text-left px-3 py-2 text-sm transition-colors ${
                          activeFilter === f.value
                            ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 font-medium'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
