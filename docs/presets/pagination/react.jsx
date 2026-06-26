// snippet: nav-pagination
// category: navigation
// rationale: components/navigation.md
// requires: tailwindcss

import { useState, useMemo } from 'react';

export function Pagination({ totalPages = 10, onPageChange }) {
  const [currentPage, setCurrentPage] = useState(1);

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    onPageChange?.(page);
  };

  const pages = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (currentPage <= 4) return [1, 2, 3, 4, 5, '...', totalPages];
    if (currentPage >= totalPages - 3) return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  }, [currentPage, totalPages]);

  return (
    <nav className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-4 sm:px-6 py-3" aria-label="Pagination">
      <div className="flex items-center justify-between gap-1">
        {/* Previous */}
        <button
          disabled={currentPage === 1}
          onClick={() => handlePageChange(currentPage - 1)}
          className={`inline-flex items-center justify-center min-h-11 min-w-11 px-2 sm:px-3 py-2 text-sm font-medium rounded-lg ${
            currentPage === 1
              ? 'text-slate-600 dark:text-slate-400 cursor-not-allowed'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none'
          }`}
          aria-label="Previous page"
        >
          <svg className="w-4 h-4 sm:mr-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" /></svg>
          <span className="hidden sm:inline" aria-hidden="true">Previous</span>
        </button>

        {/* Page numbers (desktop) */}
        <div className="hidden sm:flex items-center gap-1">
          {pages.map((page, i) =>
            page === '...' ? (
              <span key={`ellipsis-${i}`} className="min-h-11 min-w-11 px-3 py-2 text-sm text-slate-600 dark:text-slate-400 flex items-center justify-center" aria-hidden="true">&hellip;</span>
            ) : (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`min-h-11 min-w-11 px-3 py-2 text-sm font-medium rounded-lg focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${
                  page === currentPage
                    ? 'text-white bg-blue-700'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors'
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
          className={`inline-flex items-center justify-center min-h-11 min-w-11 px-2 sm:px-3 py-2 text-sm font-medium rounded-lg ${
            currentPage === totalPages
              ? 'text-slate-600 dark:text-slate-400 cursor-not-allowed'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none'
          }`}
          aria-label="Next page"
        >
          <span className="hidden sm:inline" aria-hidden="true">Next</span>
          <svg className="w-4 h-4 sm:ml-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
    </nav>
  );
}
