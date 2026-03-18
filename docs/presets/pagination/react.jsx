// snippet: nav-pagination
// category: navigation
// rationale: components/navigation.md
// requires: tailwindcss

import { useState, useMemo } from 'react';

export function Pagination({ totalItems = 97, itemsPerPage = 10, totalPages: totalPagesProp, onPageChange }) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = totalPagesProp || Math.ceil(totalItems / itemsPerPage);

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    onPageChange?.(page);
  };

  const pages = useMemo(() => {
    const items = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) items.push(i);
      return items;
    }
    items.push(1);
    if (currentPage > 3) items.push('...');
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) items.push(i);
    if (currentPage < totalPages - 2) items.push('...');
    items.push(totalPages);
    return items;
  }, [currentPage, totalPages]);

  const rangeStart = (currentPage - 1) * itemsPerPage + 1;
  const rangeEnd = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <nav className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-4 sm:px-6 py-3" aria-label="Pagination">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Showing <span className="font-medium text-slate-900 dark:text-white">{rangeStart}</span>–<span className="font-medium text-slate-900 dark:text-white">{rangeEnd}</span> of <span className="font-medium text-slate-900 dark:text-white">{totalItems}</span> results
        </p>

        <div className="flex items-center gap-1">
          {/* Previous */}
          <button
            disabled={currentPage === 1}
            onClick={() => handlePageChange(currentPage - 1)}
            className={`inline-flex items-center justify-center min-h-11 min-w-11 px-2 sm:px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              currentPage === 1
                ? 'text-slate-400 dark:text-slate-500 cursor-not-allowed'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
            aria-label="Previous page"
          >
            <svg className="w-4 h-4 sm:mr-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" /></svg>
            <span className="hidden sm:inline">Previous</span>
          </button>

          {/* Page numbers (desktop) */}
          <div className="hidden sm:flex items-center gap-1">
            {pages.map((page, i) =>
              page === '...' ? (
                <span key={`ellipsis-${i}`} className="min-h-11 min-w-11 px-3 py-2 text-sm text-slate-400 dark:text-slate-500 flex items-center justify-center" aria-hidden="true">&hellip;</span>
              ) : (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`min-h-11 min-w-11 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    page === currentPage
                      ? 'text-white bg-blue-600'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                  aria-current={page === currentPage ? 'page' : undefined}
                  aria-label={`Page ${page}`}
                >
                  {page}
                </button>
              )
            )}
          </div>

          {/* Mobile page indicator */}
          <span className="sm:hidden text-sm text-slate-600 dark:text-slate-400 px-3">
            Page {currentPage} of {totalPages}
          </span>

          {/* Next */}
          <button
            disabled={currentPage === totalPages}
            onClick={() => handlePageChange(currentPage + 1)}
            className={`inline-flex items-center justify-center min-h-11 min-w-11 px-2 sm:px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              currentPage === totalPages
                ? 'text-slate-400 dark:text-slate-500 cursor-not-allowed'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
            aria-label="Next page"
          >
            <span className="hidden sm:inline">Next</span>
            <svg className="w-4 h-4 sm:ml-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
    </nav>
  );
}
