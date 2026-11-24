import React, { useEffect, useRef } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LayoutGroup, motion } from 'motion/react';
import {
  ArrowLeft,
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
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { notificationsApi } from '../lib/api';
import {
  OfflineIndicator,
  PullToRefreshIndicator,
  PWAInstallButton,
} from './PWAStatus';

export function Layout({
  children,
  focusMode = false,
  hideDesktopBack = false,
  onRefresh,
}: {
  children: React.ReactNode;
  focusMode?: boolean;
  hideDesktopBack?: boolean;
  onRefresh?: () => Promise<unknown>;
}) {
  const { profile } = useAuth();
  const isOnline = useOnlineStatus();
  const navigate = useNavigate();
  const location = useLocation();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const {
    pullDistance,
    status: pullStatus,
    progress: pullProgress,
    justReconnected,
    dismissReconnected,
    triggerRefresh,
  } = usePullToRefresh({
    scrollRef: scrollContainerRef,
    onRefresh,
    isOnline,
  });

  useEffect(() => {
    if (!location.hash && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [location.pathname, location.hash]);

  const handleBack = () => {
    const historyIdx =
      typeof window.history.state?.idx === 'number'
        ? window.history.state.idx
        : 0;
    if (historyIdx > 0) {
      navigate(-1);
    } else if (location.pathname !== '/home' && location.pathname !== '/') {
      navigate('/home');
    } else {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

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
    <div className="sanctuary-shell h-[100dvh] max-h-[100dvh] overflow-hidden md:h-auto md:max-h-none md:min-h-screen md:overflow-visible bg-slate-50 dark:bg-[#070B19] text-slate-900 dark:text-slate-100 sanctuary-glow flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      {!focusMode && (
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
            className="sw-btn-primary w-full min-h-[46px] flex items-center justify-center gap-2 rounded-xl bg-cyan-600 dark:bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-white dark:text-slate-950 hover:bg-cyan-500 dark:hover:bg-cyan-400 transition-all cursor-pointer whitespace-nowrap"
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
                      ? 'sw-nav-active bg-cyan-500/12 text-cyan-700 dark:text-cyan-300'
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

        <div className="p-4 border-t border-slate-200/70 dark:border-indigo-950/70 space-y-2.5">
          <PWAInstallButton variant="sidebar" />
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
      )}

      {/* Main Content Shell */}
      <div
        className={`flex-1 min-w-0 min-h-0 flex flex-col md:min-h-screen ${
          focusMode ? '' : 'md:pl-64 lg:pl-72'
        }`}
      >
        {/* Mobile Top App Bar (Docked shrink-0 so it never drifts during scroll) */}
        {!focusMode && (
          <header className="md:hidden shrink-0 z-30 border-b border-slate-200/80 dark:border-indigo-950/70 bg-white/90 dark:bg-[#070B19]/90 backdrop-blur-md pt-safe select-none">
            <div className="h-[52px] px-2.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 min-w-0">
                <button
                  type="button"
                  onClick={handleBack}
                  aria-label="Go back"
                  title="Back"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-indigo-950/50 active:scale-95 transition-all shrink-0 cursor-pointer"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <Link
                  to="/home"
                  className="flex items-center gap-2 min-w-0 text-[15px] sm:text-base font-semibold tracking-tight text-slate-900 dark:text-white"
                >
                  <InfinityIcon className="h-5 w-5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                  <span className="truncate">Stranger’s Wisdom</span>
                </Link>
              </div>

              <div className="flex items-center gap-0.5 shrink-0">
                <PWAInstallButton variant="compact" />
                <Link
                  to="/search"
                  aria-label="Search questions"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 active:scale-95 transition-transform"
                >
                  <Search className="h-5 w-5" />
                </Link>
                <Link
                  to="/notifications"
                  aria-label="Notifications"
                  className="relative min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 active:scale-95 transition-transform"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-amber-500" />
                  )}
                </Link>
              </div>
            </div>
          </header>
        )}

        <OfflineIndicator
          justReconnected={justReconnected}
          onManualRefresh={
            onRefresh
              ? () => {
                  void triggerRefresh();
                }
              : undefined
          }
          onDismissReconnected={dismissReconnected}
          isRefreshing={pullStatus === 'refreshing'}
        />

        {/* Dedicated App Scroll View (Mobile scrolls only here; Desktop scrolls document naturally) */}
        <div
          ref={scrollContainerRef}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain touch-pan-y md:overflow-visible"
        >
          {onRefresh && (
            <PullToRefreshIndicator
              status={pullStatus}
              pullDistance={pullDistance}
              progress={pullProgress}
            />
          )}
          <main
            className={`w-full mx-auto ${
              focusMode
                ? 'max-w-3xl px-5 sm:px-8 py-6 sm:py-12 pb-12'
                : 'max-w-5xl px-4 sm:px-8 py-5 sm:py-10 pb-8 md:pb-24'
            }`}
          >
            {!focusMode && !hideDesktopBack && (
              <div className="hidden md:flex items-center mb-5">
                <button
                  type="button"
                  onClick={handleBack}
                  aria-label="Go back"
                  className="min-h-[40px] inline-flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-indigo-950/50 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back</span>
                </button>
              </div>
            )}
            {children}
          </main>
        </div>

        {/* Mobile Bottom Navigation Bar (Docked shrink-0 inside 100dvh shell, unified baseline + bottom-bar indicator) */}
        {!focusMode && (
          <nav
            aria-label="Mobile bottom navigation"
            className="md:hidden shrink-0 z-40 border-t border-slate-200/90 dark:border-indigo-950/80 bg-white/95 dark:bg-[#090F22]/95 backdrop-blur-md select-none"
          >
            <LayoutGroup id="mobile-bottom-nav">
              <div className="grid grid-cols-5 items-stretch px-1 pt-1.5 pb-[max(0.35rem,env(safe-area-inset-bottom))]">
                {[
                  {
                    id: 'home',
                    to: '/home',
                    label: 'Home',
                    active: location.pathname === '/' || location.pathname === '/home',
                    icon: Home,
                  },
                  {
                    id: 'explore',
                    to: '/explore',
                    label: 'Explore',
                    active: location.pathname === '/explore',
                    icon: Compass,
                  },
                  {
                    id: 'ask',
                    to: '/ask',
                    label: 'Ask',
                    active: location.pathname === '/ask',
                    isPrimaryAction: true,
                    icon: Plus,
                  },
                  {
                    id: 'my-wisdom',
                    to: '/my-wisdom',
                    label: 'My Answers',
                    active:
                      location.pathname === '/my-questions' ||
                      location.pathname.startsWith('/my-wisdom'),
                    icon: MessageSquareHeart,
                  },
                  {
                    id: 'profile',
                    to: '/profile',
                    label: 'Profile',
                    active:
                      location.pathname === '/profile' ||
                      location.pathname === '/settings' ||
                      location.pathname === '/privacy-safety',
                    icon: User,
                  },
                ].map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <Link
                      key={tab.id}
                      to={tab.to}
                      aria-label={tab.isPrimaryAction ? 'Ask a Question' : undefined}
                      aria-current={tab.active ? 'page' : undefined}
                      title={tab.isPrimaryAction ? 'Ask a Question' : undefined}
                      className={`relative flex flex-col items-center justify-center min-h-[48px] pt-0.5 pb-2 text-[11px] transition-colors active:scale-95 ${
                        tab.isPrimaryAction
                          ? 'group font-semibold'
                          : tab.active
                          ? 'font-semibold text-cyan-600 dark:text-cyan-400'
                          : 'font-medium text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {tab.isPrimaryAction ? (
                        <>
                          <span
                            className={`sw-btn-primary flex h-7 w-11 items-center justify-center rounded-xl shadow-sm transition-all ${
                              tab.active
                                ? 'bg-cyan-400 text-slate-950 ring-2 ring-white/25'
                                : 'bg-cyan-600 dark:bg-cyan-500 text-white dark:text-slate-950 group-hover:bg-cyan-500 dark:group-hover:bg-cyan-400'
                            }`}
                          >
                            <Icon className="h-[18px] w-[18px] stroke-[2.5]" />
                          </span>
                          <span
                            className={`mt-1 leading-none whitespace-nowrap ${
                              tab.active
                                ? 'text-cyan-600 dark:text-cyan-400'
                                : 'text-cyan-700 dark:text-cyan-300'
                            }`}
                          >
                            {tab.label}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="flex h-7 items-center justify-center">
                            <Icon className="h-5 w-5" strokeWidth={tab.active ? 2.25 : 1.9} />
                          </span>
                          <span className="mt-1 leading-none whitespace-nowrap">
                            {tab.label}
                          </span>
                        </>
                      )}

                      {tab.active && (
                        <motion.span
                          layoutId="mobile-nav-bottom-bar"
                          data-bottom-bar="active"
                          aria-hidden="true"
                          transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                          className="sw-bottom-bar pointer-events-none absolute bottom-0 left-0 right-0 mx-auto h-[3px] w-8 rounded-full bg-cyan-600 dark:bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.4)]"
                        />
                      )}
                    </Link>
                  );
                })}
              </div>
            </LayoutGroup>
          </nav>
        )}
      </div>

      {/* Persistent Desktop & Tablet Floating Action Button */}
      {!focusMode && location.pathname !== '/ask' && (
        <Link
          to="/ask"
          aria-label="Ask a Question"
          className="sw-btn-primary hidden md:inline-flex fixed bottom-6 right-6 z-40 min-h-[48px] items-center gap-2.5 rounded-2xl bg-cyan-600 dark:bg-cyan-500 px-5 py-3 text-sm font-semibold text-white dark:text-slate-950 shadow-lg shadow-cyan-600/25 dark:shadow-cyan-500/25 hover:bg-cyan-500 dark:hover:bg-cyan-400 hover:-translate-y-0.5 active:scale-95 transition-all"
        >
          <Feather className="h-4 w-4 shrink-0" />
          <span className="whitespace-nowrap">Ask a Question</span>
        </Link>
      )}
    </div>
  );
}
