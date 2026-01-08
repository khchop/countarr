import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Film,
  Tv,
  Play,
  Server,
  Settings,
  BarChart3,
  Users,
  Theater,
  Trophy,
  Subtitles,
  FolderOpen,
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/movies', icon: Film, label: 'Movies' },
  { to: '/tv', icon: Tv, label: 'TV Shows' },
  { to: '/release-groups', icon: Users, label: 'Release Groups' },
  { to: '/genres', icon: Theater, label: 'Genres' },
  { to: '/records', icon: Trophy, label: 'Records' },
  { to: '/subtitles', icon: Subtitles, label: 'Subtitles' },
  { to: '/playback', icon: Play, label: 'Playback' },
  { to: '/indexers', icon: Server, label: 'Indexers' },
  { to: '/media', icon: FolderOpen, label: 'Media' },
];

export function Sidebar() {
  return (
    <aside className="w-64 bg-background-secondary border-r border-border flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-border">
        <BarChart3 className="w-8 h-8 text-accent-blue mr-3" />
        <span className="text-xl font-semibold">Countarr</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        <ul className="space-y-1 px-3">
          {navItems.map(({ to, icon: Icon, label }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `flex items-center px-3 py-2.5 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-accent-blue/10 text-accent-blue'
                      : 'text-text-muted hover:text-text hover:bg-background-tertiary'
                  }`
                }
              >
                <Icon className="w-5 h-5 mr-3" />
                <span className="font-medium">{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Settings at bottom */}
      <div className="p-3 border-t border-border">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center px-3 py-2.5 rounded-lg transition-colors ${
              isActive
                ? 'bg-accent-blue/10 text-accent-blue'
                : 'text-text-muted hover:text-text hover:bg-background-tertiary'
            }`
          }
        >
          <Settings className="w-5 h-5 mr-3" />
          <span className="font-medium">Settings</span>
        </NavLink>
      </div>
    </aside>
  );
}
