import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Package, Repeat, Wrench, Archive, FolderTree, FileText, History, DatabaseBackup, Settings, LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Routes visible to every authenticated user. Admin-only routes (Reports,
// Audit Log, Backup & Restore) are appended below.
const USER_NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/items', label: 'Assets', icon: Package },
  { to: '/checkouts', label: 'Check In / Out', icon: Repeat },
  { to: '/maintenance', label: 'Maintenance', icon: Wrench },
  { to: '/retirements', label: 'Retirement', icon: Archive },
  { to: '/history', label: 'Asset History', icon: FolderTree },
];

const ADMIN_NAV = [
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/audit', label: 'Audit Log', icon: History },
  { to: '/backup', label: 'Backup & Restore', icon: DatabaseBackup },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';
  const nav = isAdmin ? [...USER_NAV, ...ADMIN_NAV] : USER_NAV;

  return (
    <aside className="w-64 shrink-0 bg-neutral-950 text-neutral-300 flex flex-col h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-neutral-800 flex items-center gap-3">
        <img src="/logo.png" alt="Asset Tracker logo" className="h-9 w-9 object-contain shrink-0" />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white tracking-tight truncate">LACED Media Production</div>
          <div className="text-xs text-neutral-500 truncate">Asset Management</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {nav.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-600 text-white'
                    : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100'
                }`
              }
            >
              <Icon size={17} strokeWidth={1.75} className="shrink-0" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-neutral-800 p-4">
        <div className="text-sm font-medium text-white truncate">{user?.full_name || user?.username}</div>
        <div className="text-xs text-neutral-500 mb-3">{isAdmin ? 'Administrator' : 'Viewer'}</div>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `w-full flex items-center gap-2 text-xs font-medium rounded-lg py-2 px-2.5 mb-1.5 transition-colors ${
              isActive
                ? 'bg-brand-600 text-white'
                : 'text-neutral-300 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-800'
            }`
          }
        >
          <Settings size={14} strokeWidth={1.75} />
          Settings
        </NavLink>
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg py-2 transition-colors"
        >
          <LogOut size={14} strokeWidth={1.75} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
