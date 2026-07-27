export default function UserList({ users, currentUser }) {
  return (
    <ul className="space-y-3" role="list" aria-label="Connected users">
      {users.map((user, index) => (
        <li key={`${user.name}-${index}`} className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-xl border border-slate-600/50">
          <div className="flex items-center gap-3">
            {user.isHost && (
              <span className="text-yellow-400 text-xl flex-shrink-0" aria-label="Host" title="Host">👑</span>
            )}
            <span className={`font-medium ${user.name === currentUser ? 'text-white' : 'text-slate-200'}`}>
              {user.name}
              {user.name === currentUser && ' (You)'}
            </span>
          </div>
          {user.isHost && (
            <span className="ml-auto px-2 py-1 text-xs font-medium bg-yellow-500/20 text-yellow-300 rounded-full border border-yellow-500/30">
              Host
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}