// snippet: content-avatar-group
// category: content
// rationale: components/cards.md
// requires: tailwindcss

import { memo } from 'react';

const defaultUsers = [
  { id: 1, name: 'Sarah Chen', initials: 'SC', color: 'bg-[#1d4ed8]', status: 'online' },
  { id: 2, name: 'James Wilson', initials: 'JW', color: 'bg-[#6d28d9]', status: 'online' },
  { id: 3, name: 'Maria Garcia', initials: 'MG', color: 'bg-[#92400e]', status: 'offline' },
  { id: 4, name: 'Alex Thompson', initials: 'AT', color: 'bg-[#be123c]', status: 'online' },
  { id: 5, name: 'Priya Patel', initials: 'PP', color: 'bg-teal-600', status: 'online' },
  { id: 6, name: 'David Kim', initials: 'DK', color: 'bg-indigo-600', status: 'offline' },
  { id: 7, name: 'Emma Brown', initials: 'EB', color: 'bg-pink-600', status: 'online' },
];

const sizeConfig = {
  sm: {
    avatar: 'w-7 h-7',
    text: 'text-xs',
    spacing: '-space-x-2',
    dot: 'w-2 h-2 border',
  },
  md: {
    avatar: 'w-9 h-9',
    text: 'text-xs',
    spacing: '-space-x-2',
    dot: 'w-3 h-3 border-2',
  },
  lg: {
    avatar: 'w-12 h-12',
    text: 'text-sm',
    spacing: '-space-x-3',
    dot: 'w-3 h-3 border-2',
  },
};

// Memoized — AvatarGroup passes the same users array reference and primitive
// size/max props on every render, so memo prevents spurious re-renders.
const AvatarRow = memo(function AvatarRow({ users, max, size }) {
  const config = sizeConfig[size] || sizeConfig.md;
  const visible = users.slice(0, max);
  const remaining = users.length - max;

  return (
    <div className="flex items-center">
      <div role="group" aria-label="Team members" className={`flex ${config.spacing}`}>
        {visible.map((user) => (
          <div key={user.id} className="relative">
            <div
              className={`${config.avatar} rounded-full border-2 border-white dark:border-slate-800 ${user.color} flex items-center justify-center text-white ${config.text} font-medium`}
              title={user.name}
            >
              {user.initials}
            </div>
            <span
              className={`absolute bottom-0 right-0 ${config.dot} border-white dark:border-slate-800 rounded-full ${
                user.status === 'online' ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-500'
              }`}
              aria-label={user.status === 'online' ? 'Online' : 'Offline'}
            />
          </div>
        ))}
        {remaining > 0 && (
          <div
            className={`${config.avatar} rounded-full border-2 border-white dark:border-slate-800 bg-slate-100 dark:bg-slate-700 flex items-center justify-center ${config.text} font-medium text-slate-700 dark:text-slate-300`}
            title={`${remaining} more member${remaining === 1 ? '' : 's'}`}
          >
            +{remaining}
          </div>
        )}
      </div>
    </div>
  );
});

export function AvatarGroup({ users = defaultUsers, maxVisible = 4 }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 sm:p-8 md:p-10 bg-slate-50 dark:bg-slate-900">
      <div className="w-full max-w-md">
        <header className="mb-6 md:mb-8">
          <h1 className="text-base font-semibold text-slate-800 dark:text-slate-200">Avatar Groups</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Overlapping teams with status indicators</p>
        </header>
        <section aria-label="Avatar size examples" className="flex flex-col gap-6 sm:gap-7 md:gap-8">
          <AvatarRow users={users} max={maxVisible} size="lg" />
          <AvatarRow users={users} max={maxVisible} size="md" />
          <AvatarRow users={users} max={maxVisible} size="sm" />
        </section>
        <footer className="mt-8 md:mt-10 pt-4 border-t border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">Component · avatar groups</p>
        </footer>
      </div>
    </main>
  );
}
