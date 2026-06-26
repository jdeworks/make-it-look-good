// snippet: nav-tabs
// category: navigation
// rationale: components/navigation.md
// requires: tailwindcss

import { useState, useRef, useCallback, memo } from 'react';

const defaultTabs = [
  { id: 'overview', label: 'Overview', content: 'This is the overview panel. It provides a summary of all the key information you need at a glance.' },
  { id: 'features', label: 'Features', content: 'Explore all the features available. Each feature is designed to improve your workflow and productivity.' },
  { id: 'reviews', label: 'Reviews', content: 'Read what our users have to say. Over 2,000 verified reviews with an average rating of 4.8 stars.' },
  { id: 'settings', label: 'Settings', content: 'Configure your preferences. Adjust notifications, display options, and account details here.' },
];

const TabButton = memo(function TabButton({ tab, selected, onSelect, onKeyDown }) {
  return (
    <button
      role="tab"
      data-tab-id={tab.id}
      aria-selected={selected}
      aria-controls={`panel-${tab.id}`}
      id={`tab-${tab.id}`}
      tabIndex={selected ? 0 : -1}
      onClick={() => onSelect(tab.id)}
      onKeyDown={onKeyDown}
      className={`relative min-h-11 px-4 py-3 text-sm font-semibold whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 rounded-t-md ${
        selected
          ? 'text-blue-700 dark:text-blue-400 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-700 dark:after:bg-blue-400'
          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors'
      }`}
    >
      {tab.label}
    </button>
  );
});

export function Tabs({ tabs = defaultTabs }) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id);
  const tablistRef = useRef(null);

  const handleKeyDown = useCallback((e) => {
    const tabButtons = tablistRef.current?.querySelectorAll('[role="tab"]');
    if (!tabButtons) return;
    const tabArr = [...tabButtons];
    const idx = tabArr.indexOf(e.target);
    let next;

    if (e.key === 'ArrowRight') next = tabArr[(idx + 1) % tabArr.length];
    else if (e.key === 'ArrowLeft') next = tabArr[(idx - 1 + tabArr.length) % tabArr.length];
    else if (e.key === 'Home') next = tabArr[0];
    else if (e.key === 'End') next = tabArr[tabArr.length - 1];

    if (next) {
      e.preventDefault();
      next.focus();
      setActiveTab(next.dataset.tabId);
    }
  }, []);

  const handleSelect = useCallback((id) => {
    setActiveTab(id);
  }, []);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
      {/* Tab list */}
      <div className="border-b border-slate-200 dark:border-slate-700 px-4 sm:px-6">
        <nav
          className="flex gap-0 -mb-px overflow-x-auto"
          role="tablist"
          aria-label="Content tabs"
          ref={tablistRef}
        >
          {tabs.map((tab) => (
            <TabButton
              key={tab.id}
              tab={tab}
              selected={tab.id === activeTab}
              onSelect={handleSelect}
              onKeyDown={handleKeyDown}
            />
          ))}
        </nav>
      </div>

      {/* Tab panels */}
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <div
            key={tab.id}
            id={`panel-${tab.id}`}
            role="tabpanel"
            aria-labelledby={`tab-${tab.id}`}
            tabIndex={0}
            aria-hidden={!isActive}
            className={`p-4 sm:p-6${isActive ? '' : ' hidden'}`}
          >
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{tab.label}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{tab.content}</p>
          </div>
        );
      })}
    </div>
  );
}
