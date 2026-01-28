import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: '📊' },
  { path: '/activity', label: 'Activity', icon: '⚡' },
  { path: '/chat', label: 'AI Chat', icon: '💬' },
  { path: '/autonomous', label: 'Autonomous AI', icon: '🧠' },
  { path: '/agents', label: 'Agents', icon: '🤖' },
  { path: '/agent-teams', label: 'Agent Teams', icon: '👥' },
  { path: '/workflow-builder', label: 'Workflows', icon: '🔄' },
  { path: '/approvals', label: 'Approvals', icon: '✅' },
  { path: '/knowledge', label: 'Knowledge Base', icon: '📚' },
  { path: '/prospects', label: 'Prospects', icon: '🎯' },
  { path: '/meetings', label: 'Meetings', icon: '📅' },
  { path: '/integrations', label: 'Integrations', icon: '🔌' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold text-gray-900">EngageAI</h1>
          <p className="text-sm text-gray-500">Sales Engine</p>
        </div>
        
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {navItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    location.pathname === item.path
                      ? 'bg-primary text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-4 border-t">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-primary font-semibold">
                {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.firstName || user?.email}
              </p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
          <Button variant="outline" className="w-full" onClick={logout}>
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
