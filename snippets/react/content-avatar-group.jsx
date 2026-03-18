// snippet: content-avatar-group
// category: content
// rationale: components/cards.md
// requires: tailwindcss

const defaultUsers = [
  { id: 1, name: 'Sarah Chen', initials: 'SC', color: 'bg-blue-600', status: 'online' },
  { id: 2, name: 'James Wilson', initials: 'JW', color: 'bg-purple-600', status: 'online' },
  { id: 3, name: 'Maria Garcia', initials: 'MG', color: 'bg-amber-600', status: 'offline' },
  { id: 4, name: 'Alex Thompson', initials: 'AT', color: 'bg-rose-600', status: 'online' },
  { id: 5, name: 'Priya Patel', initials: 'PP', color: 'bg-teal-600', status: 'online' },
  { id: 6, name: 'David Kim', initials: 'DK', color: 'bg-indigo-600', status: 'offline' },
  { id: 7, name: 'Emma Brown', initials: 'EB', color: 'bg-pink-600', status: 'online' },
];

const sizeConfig = {
  sm: {
    avatar: 'w-7 h-7',
    text: 'text-[10px]',
    spacing: '-space-x-1.5',
    dot: 'w-2 h-2 border',
  },
  md: {
    avatar: 'w-9 h-9',
    text: 'text-xs',
    spacing: '-space-x-2',
    dot: 'w-2.5 h-2.5 border-2',
  },
  lg: {
    avatar: 'w-12 h-12',
    text: 'text-sm',
    spacing: '-space-x-3',
    dot: 'w-3 h-3 border-2',
  },
};

export function AvatarGroup({ users = defaultUsers, max = 4, size = 'md' }) {
  const config = sizeConfig[size] || sizeConfig.md;
  const visible = users.slice(0, max);
  const remaining = users.length - max;

  return (
    <div className="flex items-center">
      <div className={`flex ${config.spacing}`}>
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
            className={`${config.avatar} rounded-full border-2 border-white dark:border-slate-800 bg-slate-100 dark:bg-slate-700 flex items-center justify-center ${config.text} font-medium text-slate-600 dark:text-slate-300`}
            title={`${remaining} more member${remaining === 1 ? '' : 's'}`}
          >
            +{remaining}
          </div>
        )}
      </div>
    </div>
  );
}
