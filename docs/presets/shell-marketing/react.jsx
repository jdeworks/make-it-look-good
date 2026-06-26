// snippet: nav-topbar
// category: navigation
// rationale: components/navigation.md
// requires: tailwindcss

import { useState } from 'react';

export function ShellMarketing() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div id="shellMarketingWrap" className="min-h-screen bg-slate-50 dark:bg-slate-950">

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-300 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <a href="#" className="text-lg font-semibold text-slate-900 dark:text-white">BrandName</a>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
              <a href="#" className="px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white rounded-md transition-colors">Features</a>
              <a href="#" className="px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white rounded-md transition-colors">Pricing</a>
              <a href="#" className="px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white rounded-md transition-colors">About</a>
              <a href="#" className="px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white rounded-md transition-colors">Blog</a>
            </nav>

            {/* CTA + Mobile toggle */}
            <div className="flex items-center gap-3">
              <a href="#" className="hidden sm:inline-flex bg-blue-700 hover:bg-blue-800 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors min-h-11 items-center">Get Started</a>
              <button
                className="md:hidden p-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg min-h-11 min-w-11 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle menu"
                aria-expanded={mobileMenuOpen}
                aria-controls="shellMktMobileMenu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
              </button>
            </div>
          </div>

          {/* Mobile menu */}
          {mobileMenuOpen && (
            <div id="shellMktMobileMenu" className="pb-4 border-t border-slate-200 dark:border-slate-700 mt-2 pt-4">
              <nav className="flex flex-col gap-1" aria-label="Mobile navigation">
                <a href="#" className="px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">Features</a>
                <a href="#" className="px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">Pricing</a>
                <a href="#" className="px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">About</a>
                <a href="#" className="px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">Blog</a>
                <a href="#" className="mt-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold px-4 py-2.5 rounded-lg text-sm text-center transition-colors min-h-11">Get Started</a>
              </nav>
            </div>
          )}
        </div>
      </header>

      {/* Main Content — drop content-* snippets here */}
      <main>
        {/* Hero Section slot */}
        <section className="py-16 md:py-24 lg:py-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-slate-900 dark:text-white tracking-tight">Your headline goes here</h1>
            <p className="mt-6 text-lg sm:text-xl text-slate-700 dark:text-slate-300 max-w-2xl mx-auto">A brief description of your product or service. Keep it under two sentences for maximum impact.</p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <a href="#" className="bg-blue-700 hover:bg-blue-800 text-white font-semibold px-6 py-3 rounded-lg text-base transition-colors min-h-11 inline-flex items-center justify-center">Get Started Free</a>
              <a href="#" className="border border-slate-400 dark:border-slate-500 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold px-6 py-3 rounded-lg text-base transition-colors min-h-11 inline-flex items-center justify-center">Learn More</a>
            </div>
          </div>
        </section>

        {/* Section slot — repeat as needed */}
        <section className="py-12 md:py-16 lg:py-20 bg-slate-50 dark:bg-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-slate-700 dark:text-slate-300 text-center">Replace with content-feature-grid, content-pricing-cards, content-testimonials, etc.</p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 dark:bg-slate-950 text-slate-300 py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <h2 className="text-sm font-semibold text-white mb-4">Product</h2>
              <ul className="space-y-3">
                <li><a href="#" className="text-sm hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="text-sm hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="text-sm hover:text-white transition-colors">Changelog</a></li>
              </ul>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white mb-4">Company</h2>
              <ul className="space-y-3">
                <li><a href="#" className="text-sm hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="text-sm hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="text-sm hover:text-white transition-colors">Careers</a></li>
              </ul>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white mb-4">Resources</h2>
              <ul className="space-y-3">
                <li><a href="#" className="text-sm hover:text-white transition-colors">Documentation</a></li>
                <li><a href="#" className="text-sm hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#" className="text-sm hover:text-white transition-colors">Community</a></li>
              </ul>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white mb-4">Legal</h2>
              <ul className="space-y-3">
                <li><a href="#" className="text-sm hover:text-white transition-colors">Privacy</a></li>
                <li><a href="#" className="text-sm hover:text-white transition-colors">Terms</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-slate-800 text-sm text-center">
            © 2026 BrandName. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
