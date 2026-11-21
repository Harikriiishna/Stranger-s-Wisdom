import React from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  Bookmark,
  Compass,
  Feather,
  Home,
  Infinity as InfinityIcon,
  MessageSquareHeart,
  Plus,
  Radio,
  Search,
  Shield,
  Sparkles,
  User,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { notificationsApi } from '../lib/api';

export function Layout({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.list,
    enabled: Boolean(profile),
    staleTime: 30000,
  });

  const unreadCount = notifData?.unreadCount ?? 0;

  const desktopNavItems = [
    { to: '/home', label: 'Home', icon: Home },
    { to: '/explore', label: 'Explore', icon: Compass },
    { to: '/search', label: 'Search', icon: Search },
    { to: '/perspective', label: 'Give Me a Perspective', icon: Sparkles },
    { to: '/one-voice', label: 'One Voice', icon: Radio },
    { to: '/my-wisdom', label: 'My Answers', icon: MessageSquareHeart },
    { to: '/saved', label: 'Saved Wisdom', icon: Bookmark },
    { to: '/notifications', label: 'Notifications', icon: Bell, badge: unreadCount },
    { to: '/profile', label: 'Profile', icon: User },
  ];

  if (profile?.role === 'moderator' || profile?.role === 'admin') {
    desktopNavItems.push({
      to: '/moderation',
      label: 'Moderation',
      icon: Shield,
    });
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070B19] text-slate-900 dark:text-slate-100 sanctuary-glow flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 lg:w-72 md:flex-col md:fixed md:inset-y-0 border-r border-slate-200/80 dark:border-indigo-950/70 bg-white/85 dark:bg-[#090F22]/90 backdrop-blur-md z-30">
        <div className="p-6 pb-4">
          <Link to="/home" className="flex items-center gap-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-cyan-500/30 text-cyan-600 dark:text-cyan-300">
              <InfinityIcon className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
              Stranger’s Wisdom
            </span>
          </Link>
        </div>

        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={() => navigate('/ask')}
            className="w-full min-h-[46px] flex items-center justify-center gap-2 rounded-xl bg-cyan-600 dark:bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-white dark:text-slate-950 hover:bg-cyan-500 dark:hover:bg-cyan-400 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Feather className="h-4 w-4" />
            Ask Something
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 space-y-1" aria-label="Primary navigation">
          {desktopNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-cyan-500/12 text-cyan-700 dark:text-cyan-300'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-indigo-950/50 hover:text-slate-900 dark:hover:text-slate-100'
                  }`
                }
              >
                <span className="flex items-center gap-3 truncate">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span className="font-tabular text-xs font-semibold text-amber-600 dark:text-amber-400">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200/70 dark:border-indigo-950/70">
          {profile ? (
            <Link
              to="/profile"
              className="flex items-center justify-between rounded-xl px-3 py-2 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-indigo-950/40"
            >
              <span className="truncate font-medium text-slate-800 dark:text-slate-200">
                {profile.privateAlias}
              </span>
              <span className="text-slate-400">Private</span>
            </Link>
          ) : (
            <Link
              to="/signin"
              className="flex min-h-[42px] items-center justify-center rounded-xl border border-slate-300 dark:border-indigo-800 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-indigo-950/50"
            >
              Sign in or join
            </Link>
          )}
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex-1 min-w-0 md:pl-64 lg:pl-72 flex flex-col min-h-screen">
        {/* Mobile Top Bar (Three-Zone Contract, compact 52px) */}
        <header className="md:hidden sticky top-0 z-30 h-14 px-4 flex items-center justify-between gap-4 border-b border-slate-200/80 dark:border-indigo-950/70 bg-white/90 dark:bg-[#070B19]/90 backdrop-blur-md pt-safe">
          <Link
            to="/home"
            className="flex items-center gap-2 text-base font-semibold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
          >
            <InfinityIcon className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            <span>Stranger’s Wisdom</span>
          </Link>

          <div className="flex items-center gap-1 shrink-0">
            <Link
              to="/search"
              aria-label="Search questions"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300"
            >
              <Search className="h-5 w-5" />
            </Link>
            <Link
              to="/notifications"
              aria-label="Notifications"
              className="relative min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-amber-500" />
              )}
            </Link>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 min-w-0 w-full max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-10 pb-28 md:pb-24">
          {children}
        </main>
      </div>

      {/* Persistent Desktop & Tablet Floating Action Button */}
      {location.pathname !== '/ask' && (
        <Link
          to="/ask"
          aria-label="Ask a Question"
          className="hidden md:inline-flex fixed bottom-6 right-6 z-40 min-h-[48px] items-center gap-2.5 rounded-2xl bg-cyan-600 dark:bg-cyan-500 px-5 py-3 text-sm font-semibold text-white dark:text-slate-950 shadow-lg shadow-cyan-600/25 dark:shadow-cyan-500/25 hover:bg-cyan-500 dark:hover:bg-cyan-400 hover:-translate-y-0.5 active:scale-95 transition-all"
        >
          <Feather className="h-4 w-4 shrink-0" />
          <span className="whitespace-nowrap">Ask a Question</span>
        </Link>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile bottom navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/90 dark:border-indigo-950/80 bg-white/95 dark:bg-[#090F22]/95 backdrop-blur-md pb-safe"
      >
        <div className="grid grid-cols-5 items-center h-16 px-1">
          <NavLink
            to="/home"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center min-h-[44px] text-[11px] font-medium transition-colors ${
                isActive
                  ? 'text-cyan-600 dark:text-cyan-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`
            }
          >
            <Home className="h-5 w-5" />
            <span className="mt-1">Home</span>
          </NavLink>

          <NavLink
            to="/explore"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center min-h-[44px] text-[11px] font-medium transition-colors ${
                isActive
                  ? 'text-cyan-600 dark:text-cyan-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`
            }
          >
            <Compass className="h-5 w-5" />
            <span className="mt-1">Explore</span>
          </NavLink>

          <Link
            to="/ask"
            aria-label="Ask a Question"
            title="Ask a Question"
            className="flex flex-col items-center justify-center min-h-[44px] group"
          >
            <span
              className={`-mt-5 flex h-12 w-12 items-center justify-center rounded-2xl ring-4 ring-white dark:ring-[#090F22] shadow-lg shadow-cyan-600/30 dark:shadow-cyan-500/30 transition-transform group-active:scale-95 ${
                location.pathname === '/ask'
                  ? 'bg-cyan-400 text-slate-950'
                  : 'bg-cyan-600 dark:bg-cyan-500 text-white dark:text-slate-950 hover:bg-cyan-500 dark:hover:bg-cyan-400'
              }`}
            >
              <Plus className="h-5 w-5" />
            </span>
            <span
              className={`mt-0.5 text-[11px] font-semibold whitespace-nowrap ${
                location.pathname === '/ask'
                  ? 'text-cyan-600 dark:text-cyan-400'
                  : 'text-cyan-700 dark:text-cyan-300'
              }`}
            >
              Ask
            </span>
          </Link>

          <NavLink
            to="/my-wisdom"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center min-h-[44px] text-[11px] font-medium transition-colors ${
                isActive
                  ? 'text-cyan-600 dark:text-cyan-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`
            }
          >
            <MessageSquareHeart className="h-5 w-5" />
            <span className="mt-1 whitespace-nowrap">My Answers</span>
          </NavLink>

          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center min-h-[44px] text-[11px] font-medium transition-colors ${
                isActive
                  ? 'text-cyan-600 dark:text-cyan-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`
            }
          >
            <User className="h-5 w-5" />
            <span className="mt-1">Profile</span>
          </NavLink>
        </div>
      </nav>
    </div>
  );
}
