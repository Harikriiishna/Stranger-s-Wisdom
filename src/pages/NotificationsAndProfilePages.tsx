import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Check,
  CheckCheck,
  ChevronRight,
  Download,
  HelpCircle,
  Lock,
  LogOut,
  Palette,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  User,
  HardDriveDownload,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { PWAInstallButton } from '../components/PWAStatus';
import {
  CrisisSupportBanner,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  SuccessConfirmation,
} from '../components/StateViews';
import { useAuth } from '../contexts/AuthContext';
import {
  authApi,
  moderationApi,
  notificationsApi,
  profileApi,
} from '../lib/api';
import { formatTimeAgo, REPORT_REASONS } from '../lib/format';
import { clearAllOfflineCache, getOfflineCacheStats } from '../lib/offlineCache';
import { THEME_OPTIONS } from '../lib/themes';

export function NotificationsPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.list,
    enabled: Boolean(profile),
  });

  const markRead = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : 'Unable to mark notification read.');
    },
  });

  const readAll = useMutation({
    mutationFn: notificationsApi.readAll,
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : 'Unable to mark notifications read.');
    },
  });

  const clearAll = useMutation({
    mutationFn: notificationsApi.clear,
    onSuccess: () => {
      setActionError(null);
      setConfirmClear(false);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : 'Unable to clear notifications.');
    },
  });

  if (!profile) {
    return (
      <Layout>
        <div className="max-w-xl mx-auto py-10">
          <EmptyState
            title="Sign in to view your notifications"
            subtitle="Gentle updates arrive here when someone answers your question or delivers a One Voice response."
            actionLabel="Sign In"
            onAction={() => navigate('/signin')}
          />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white">
              Notifications
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Thoughtful updates, without noise or pressure.
            </p>
          </div>
          {(data?.notifications ?? []).length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={readAll.isPending}
                onClick={() => readAll.mutate()}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-indigo-900 px-3.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 disabled:opacity-50 cursor-pointer"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
              {confirmClear ? (
                <>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="min-h-[40px] rounded-xl px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={clearAll.isPending}
                    onClick={() => clearAll.mutate()}
                    className="min-h-[40px] rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50 cursor-pointer"
                  >
                    {clearAll.isPending ? 'Clearing...' : 'Confirm Clear'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-indigo-900 px-3.5 py-1.5 text-xs font-medium text-rose-500 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        {actionError && (
          <p className="text-xs text-rose-500" role="alert">
            {actionError}
          </p>
        )}

        {isLoading ? (
          <LoadingSkeleton count={3} />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : (data?.notifications ?? []).length === 0 ? (
          <EmptyState
            title="All quiet here."
            subtitle="When someone replies to your question or a One Voice response arrives, you’ll see it here."
          />
        ) : (
          <div className="space-y-3">
            {data?.notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  if (!n.readAt) markRead.mutate(n.id);
                  if (n.relatedQuestionId) {
                    navigate(`/questions/${n.relatedQuestionId}`);
                  }
                }}
                className={`w-full text-left rounded-2xl border p-5 cursor-pointer transition-colors ${
                  n.readAt
                    ? 'border-slate-200/80 dark:border-indigo-950/70 bg-white dark:bg-[#0D1326]'
                    : 'border-cyan-500/40 bg-cyan-500/5 dark:bg-[#101936]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-cyan-500 shrink-0" />
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                        {n.title}
                      </h3>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {n.body}
                    </p>
                  </div>
                  <span className="font-tabular text-xs text-slate-400 shrink-0">
                    {formatTimeAgo(n.createdAt)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

export function ProfilePage() {
  const { profile, updateLocalProfile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editingAlias, setEditingAlias] = useState(false);
  const [aliasInput, setAliasInput] = useState(profile?.privateAlias || '');
  const [aliasError, setAliasError] = useState<string | null>(null);
  const [aliasSaving, setAliasSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['profile-stats'],
    queryFn: profileApi.get,
    enabled: Boolean(profile),
  });

  const modStatus = useQuery({
    queryKey: ['moderation-status'],
    queryFn: moderationApi.status,
    enabled: Boolean(profile),
  });

  const claimModMutation = useMutation({
    mutationFn: moderationApi.claimInitial,
    onSuccess: (res) => {
      updateLocalProfile(res.profile);
      queryClient.invalidateQueries({ queryKey: ['moderation-status'] });
    },
  });

  if (!profile) {
    return (
      <Layout>
        <div className="max-w-xl mx-auto py-10">
          <EmptyState
            title="Private Profile"
            subtitle="Sign in to view your private activity statistics, sync settings across devices, and manage your data."
            actionLabel="Sign In or Create Account"
            onAction={() => navigate('/signin')}
          />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <section className="rounded-3xl border border-slate-200 dark:border-indigo-950 bg-white dark:bg-[#0D1326] p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-cyan-500/30 text-cyan-600 dark:text-cyan-300">
                <User className="h-7 w-7" />
              </div>
              <div>
                <p className="text-xs font-medium text-teal-600 dark:text-teal-400">
                  Private Account · Never shown publicly
                </p>
                {editingAlias ? (
                  <div className="mt-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        maxLength={40}
                        value={aliasInput}
                        onChange={(e) => setAliasInput(e.target.value)}
                        className="rounded-lg border border-slate-300 dark:border-indigo-800 bg-slate-50 dark:bg-[#070B19] px-2.5 py-1 text-sm"
                      />
                      <button
                        type="button"
                        disabled={aliasSaving}
                        onClick={async () => {
                          setAliasError(null);
                          if (aliasInput.trim().length < 2) {
                            setAliasError('Alias must be at least 2 characters.');
                            return;
                          }
                          setAliasSaving(true);
                          try {
                            const res = await profileApi.update({
                              privateAlias: aliasInput.trim(),
                            });
                            updateLocalProfile(res.profile);
                            setEditingAlias(false);
                          } catch (err) {
                            setAliasError(
                              err instanceof Error ? err.message : 'Unable to save alias.'
                            );
                          } finally {
                            setAliasSaving(false);
                          }
                        }}
                        className="rounded-lg bg-cyan-500 px-3 py-1 text-xs font-semibold text-slate-950 disabled:opacity-50 cursor-pointer"
                      >
                        {aliasSaving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                    {aliasError && (
                      <p className="text-xs text-rose-500" role="alert">
                        {aliasError}
                      </p>
                    )}
                  </div>
                ) : (
                  <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
                    {profile.privateAlias}
                  </h1>
                )}
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Member since{' '}
                  {new Date(profile.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setAliasInput(profile.privateAlias);
                setAliasError(null);
                setEditingAlias((v) => !v);
              }}
              className="min-h-[42px] rounded-xl border border-slate-300 dark:border-indigo-800 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              {editingAlias ? 'Cancel' : 'Edit Private Alias'}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-indigo-950/60 text-center">
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#070B19]">
              <p className="font-tabular text-2xl font-semibold text-slate-900 dark:text-white">
                {isLoading ? '—' : data?.stats.questionsAsked ?? 0}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Questions Asked
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#070B19]">
              <p className="font-tabular text-2xl font-semibold text-slate-900 dark:text-white">
                {isLoading ? '—' : data?.stats.answersGiven ?? 0}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Answers Given
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#070B19]">
              <p className="font-tabular text-2xl font-semibold text-slate-900 dark:text-white">
                {isLoading ? '—' : data?.stats.savedCount ?? 0}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Saved Wisdom
              </p>
            </div>
          </div>
        </section>

        {modStatus.data?.canClaimInitialModerator && (
          <div className="rounded-2xl border border-violet-500/35 bg-violet-500/10 p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Initialize Community Moderation
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  No moderator account has been claimed yet. Claim moderator access for this workspace.
                </p>
              </div>
              <button
                type="button"
                disabled={claimModMutation.isPending}
                onClick={() => claimModMutation.mutate()}
                className="min-h-[42px] rounded-xl bg-violet-600 dark:bg-violet-500 px-4 py-2 text-xs font-semibold text-white whitespace-nowrap disabled:opacity-50 cursor-pointer"
              >
                {claimModMutation.isPending ? 'Claiming...' : 'Claim Moderator Role'}
              </button>
            </div>
            {claimModMutation.isError && (
              <p className="text-xs text-rose-500" role="alert">
                {claimModMutation.error instanceof Error
                  ? claimModMutation.error.message
                  : 'Unable to claim moderator role.'}
              </p>
            )}
          </div>
        )}

        <div className="divide-y divide-slate-200/80 dark:divide-indigo-950/70 rounded-3xl border border-slate-200 dark:border-indigo-950 bg-white dark:bg-[#0D1326] overflow-hidden">
          {[
            { to: '/my-wisdom', label: 'My Activity & Questions', icon: User },
            { to: '/saved', label: 'Saved Wisdom & Collections', icon: Lock },
            { to: '/one-voice', label: 'One Voice Deliveries', icon: Bell },
            { to: '/settings', label: 'Settings & Account Security', icon: Shield },
            { to: '/privacy-safety', label: 'Privacy & Safety', icon: ShieldAlert },
            { to: '/security', label: 'Code Scanner & Semgrep Workbench', icon: ShieldCheck },
            { to: '/help', label: 'Help & Support', icon: HelpCircle },
            ...(profile.role === 'moderator' || profile.role === 'admin'
              ? [{ to: '/moderation', label: 'Moderation Dashboard', icon: Shield }]
              : []),
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className="min-h-[56px] px-6 py-4 flex items-center justify-between text-sm font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-indigo-950/40"
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                  {item.label}
                </span>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </Link>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}

export function SettingsPage() {
  const { profile, loading: authLoading, theme, setTheme, logout, updateLocalProfile } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [cacheStats, setCacheStats] = useState<{
    cachedQuestionsCount: number;
    savedItemsCount: number;
    lastSyncedAt: number | null;
  } | null>(null);

  React.useEffect(() => {
    if (authLoading) return;
    void getOfflineCacheStats().then(setCacheStats);
  }, [profile, authLoading]);

  const toggleNotif = async (key: 'answers' | 'oneVoice' | 'savedQuestions' | 'drafts') => {
    if (!profile) return;
    setSettingsError(null);
    setSettingsMsg(null);
    const next = {
      ...profile.notificationSettings,
      [key]: !profile.notificationSettings[key],
    };
    try {
      const res = await profileApi.update({ notificationSettings: next });
      updateLocalProfile(res.profile);
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Unable to save preferences.');
    }
  };

  const handleExport = async () => {
    setSettingsError(null);
    setSettingsMsg(null);
    try {
      const data = await profileApi.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `strangers-wisdom-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setSettingsMsg('Your private data export has been downloaded.');
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Unable to export data.');
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white">
            Settings
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Manage appearance, notifications, privacy, and your private data.
          </p>
        </div>

        {settingsError && (
          <p className="text-sm text-rose-500" role="alert">
            {settingsError}
          </p>
        )}
        {settingsMsg && (
          <p className="text-sm text-teal-600 dark:text-teal-400">
            {settingsMsg}
          </p>
        )}

        {/* Appearance & Themes */}
        <section className="rounded-3xl border border-slate-200 dark:border-indigo-950 bg-white dark:bg-[#0D1326] p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Appearance &amp; Themes
              </h2>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {THEME_OPTIONS.find((t) => t.id === theme)?.label ?? 'Social Pulse'}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {THEME_OPTIONS.map((item) => {
              const selected = theme === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={async () => {
                    setSettingsError(null);
                    try {
                      await setTheme(item.id);
                    } catch (err) {
                      setSettingsError(
                        err instanceof Error ? err.message : 'Unable to save theme preference.'
                      );
                    }
                  }}
                  className={`min-h-[64px] flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors cursor-pointer ${
                    selected
                      ? 'border-cyan-500 bg-cyan-500/10 text-slate-900 dark:text-white'
                      : 'border-slate-200 dark:border-indigo-950 text-slate-700 dark:text-slate-300 hover:border-cyan-500/40'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      aria-hidden="true"
                      className={`relative flex h-9 w-9 shrink-0 overflow-hidden rounded-xl border ${
                        item.id === 'liquid-glass' || item.id === 'frost-glass'
                          ? 'border-cyan-300/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]'
                          : 'border-slate-300/60 dark:border-white/15'
                      }`}
                    >
                      <span
                        className="w-1/2 h-full"
                        style={{ backgroundColor: item.swatches[0] }}
                      />
                      <span
                        className="w-1/2 h-full flex items-end justify-end p-1"
                        style={
                          item.gradient
                            ? { backgroundImage: item.gradient }
                            : { backgroundColor: item.swatches[1] }
                        }
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full ring-1 ring-white/50"
                          style={{ backgroundColor: item.swatches[2] }}
                        />
                      </span>
                      {(item.id === 'liquid-glass' || item.id === 'frost-glass') && (
                        <span
                          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/35 via-white/10 to-transparent"
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{item.label}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  {selected && (
                    <Check className="h-4 w-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Offline Storage & App */}
        <section className="rounded-3xl border border-slate-200 dark:border-indigo-950 bg-white dark:bg-[#0D1326] p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <HardDriveDownload className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Offline Reading &amp; App
              </h2>
            </div>
            <PWAInstallButton variant="settings" />
          </div>
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            Previously viewed questions and your saved wisdom are stored locally on this device so you can keep reading when offline.
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 dark:border-indigo-950/70 bg-slate-50 dark:bg-[#070B19] px-4 py-3">
            <div className="text-xs text-slate-700 dark:text-slate-300 space-y-0.5">
              <p className="font-tabular font-medium">
                {cacheStats
                  ? `${cacheStats.cachedQuestionsCount} cached ${
                      cacheStats.cachedQuestionsCount === 1 ? 'question' : 'questions'
                    } · ${cacheStats.savedItemsCount} saved ${
                      cacheStats.savedItemsCount === 1 ? 'item' : 'items'
                    }`
                  : 'Checking local cache...'}
              </p>
              {cacheStats?.lastSyncedAt && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Last updated {formatTimeAgo(new Date(cacheStats.lastSyncedAt).toISOString())}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={async () => {
                setSettingsError(null);
                setSettingsMsg(null);
                await clearAllOfflineCache();
                setCacheStats(await getOfflineCacheStats());
                setSettingsMsg('Local offline reading cache cleared.');
              }}
              className="min-h-[38px] rounded-xl border border-slate-300 dark:border-indigo-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-indigo-950/50 cursor-pointer"
            >
              Clear Offline Cache
            </button>
          </div>
        </section>

        {profile && (
          <>
            {/* Notifications */}
            <section className="rounded-3xl border border-slate-200 dark:border-indigo-950 bg-white dark:bg-[#0D1326] p-6 space-y-4">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Notification Preferences
              </h2>
              <div className="space-y-3">
                {[
                  { key: 'answers' as const, label: 'When someone answers my question' },
                  { key: 'oneVoice' as const, label: 'When a One Voice response is delivered' },
                  { key: 'savedQuestions' as const, label: 'Activity on saved questions' },
                  { key: 'drafts' as const, label: 'Gentle draft reminders' },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center justify-between gap-4 py-1 cursor-pointer"
                  >
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      {item.label}
                    </span>
                    <input
                      type="checkbox"
                      checked={profile.notificationSettings[item.key]}
                      onChange={() => toggleNotif(item.key)}
                      className="h-4 w-4 accent-cyan-500"
                    />
                  </label>
                ))}
              </div>
            </section>

            {/* Change Password (Email users) */}
            {profile.authProvider === 'email' && (
              <section className="rounded-3xl border border-slate-200 dark:border-indigo-950 bg-white dark:bg-[#0D1326] p-6 space-y-4">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Account Security
                </h2>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setPwMsg(null);
                    setPwError(null);
                    try {
                      await authApi.changePassword({ currentPassword, newPassword });
                      setPwMsg('Password updated successfully.');
                      setCurrentPassword('');
                      setNewPassword('');
                    } catch (err) {
                      setPwError(err instanceof Error ? err.message : 'Unable to update password.');
                    }
                  }}
                  className="space-y-3"
                >
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Current password"
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-indigo-900 bg-slate-50 dark:bg-[#070B19] px-3.5 text-sm"
                  />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password (8+ characters)"
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-indigo-900 bg-slate-50 dark:bg-[#070B19] px-3.5 text-sm"
                  />
                  {pwError && <p className="text-xs text-rose-500">{pwError}</p>}
                  {pwMsg && <p className="text-xs text-teal-500">{pwMsg}</p>}
                  <button
                    type="submit"
                    className="min-h-[42px] rounded-xl bg-cyan-600 dark:bg-cyan-500 px-4 py-2 text-xs font-semibold text-white dark:text-slate-950 cursor-pointer"
                  >
                    Update Password
                  </button>
                </form>
              </section>
            )}

            {/* Data & Session */}
            <section className="rounded-3xl border border-slate-200 dark:border-indigo-950 bg-white dark:bg-[#0D1326] p-6 space-y-3">
              <button
                type="button"
                onClick={handleExport}
                className="w-full min-h-[46px] flex items-center justify-between rounded-xl border border-slate-200 dark:border-indigo-900 px-4 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-indigo-950/40 cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <Download className="h-4 w-4 text-cyan-500" />
                  Export Personal Data (JSON)
                </span>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={async () => {
                  await logout();
                  navigate('/signin');
                }}
                className="w-full min-h-[46px] flex items-center justify-between rounded-xl border border-slate-200 dark:border-indigo-900 px-4 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-indigo-950/40 cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <LogOut className="h-4 w-4 text-amber-500" />
                  Sign Out
                </span>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </button>

              {confirmDelete ? (
                <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 space-y-3">
                  <p className="text-xs text-rose-700 dark:text-rose-200">
                    This permanently removes your private account, saved wisdom, and questions. This cannot be undone.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="min-h-[40px] rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={deletingAccount}
                      onClick={async () => {
                        setSettingsError(null);
                        setDeletingAccount(true);
                        try {
                          await authApi.deleteAccount();
                          await logout();
                          navigate('/onboarding');
                        } catch (err) {
                          setSettingsError(
                            err instanceof Error ? err.message : 'Unable to delete account.'
                          );
                        } finally {
                          setDeletingAccount(false);
                        }
                      }}
                      className="min-h-[40px] rounded-xl bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50 cursor-pointer"
                    >
                      {deletingAccount ? 'Deleting...' : 'Confirm Account Deletion'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="w-full min-h-[46px] flex items-center justify-between rounded-xl border border-rose-500/30 px-4 py-2.5 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    <Trash2 className="h-4 w-4" />
                    Delete Account
                  </span>
                </button>
              )}
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}

export function PrivacySafetyPage() {
  const { profile, updateLocalProfile } = useAuth();
  const queryClient = useQueryClient();
  const [privacyError, setPrivacyError] = useState<string | null>(null);

  const togglePrivacy = async (key: 'keepActivityPrivate' | 'allowAnonymousReplies') => {
    if (!profile) return;
    setPrivacyError(null);
    const next = {
      ...profile.privacySettings,
      [key]: !profile.privacySettings[key],
    };
    try {
      const res = await profileApi.update({ privacySettings: next });
      updateLocalProfile(res.profile);
    } catch (err) {
      setPrivacyError(err instanceof Error ? err.message : 'Unable to update privacy setting.');
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white">
            Privacy & Safety
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Your identity is never exposed publicly. You stay in control of what you see.
          </p>
        </div>

        {privacyError && (
          <p className="text-sm text-rose-500" role="alert">
            {privacyError}
          </p>
        )}

        {profile && (
          <section className="rounded-3xl border border-slate-200 dark:border-indigo-950 bg-white dark:bg-[#0D1326] p-6 space-y-4">
            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  Keep my activity private
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Your questions, answers, and saved wisdom remain strictly private to you.
                </p>
              </div>
              <input
                type="checkbox"
                checked={profile.privacySettings.keepActivityPrivate}
                onChange={() => togglePrivacy('keepActivityPrivate')}
                className="h-4 w-4 accent-cyan-500"
              />
            </label>

            <label className="flex items-center justify-between gap-4 cursor-pointer pt-3 border-t border-slate-100 dark:border-indigo-950/60">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  Allow anonymous replies on my questions
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Strangers can respond thoughtfully without revealing personal details.
                </p>
              </div>
              <input
                type="checkbox"
                checked={profile.privacySettings.allowAnonymousReplies}
                onChange={() => togglePrivacy('allowAnonymousReplies')}
                className="h-4 w-4 accent-cyan-500"
              />
            </label>

            {(profile.privacySettings.hiddenQuestionIds?.length ?? 0) > 0 && (
              <div className="pt-3 border-t border-slate-100 dark:border-indigo-950/60 flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {profile.privacySettings.hiddenQuestionIds.length} hidden questions
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    setPrivacyError(null);
                    try {
                      const res = await profileApi.update({
                        privacySettings: {
                          ...profile.privacySettings,
                          hiddenQuestionIds: [],
                        },
                      });
                      updateLocalProfile(res.profile);
                      queryClient.invalidateQueries({ queryKey: ['home'] });
                      queryClient.invalidateQueries({ queryKey: ['questions'] });
                    } catch (err) {
                      setPrivacyError(
                        err instanceof Error ? err.message : 'Unable to restore hidden questions.'
                      );
                    }
                  }}
                  className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                >
                  Restore hidden questions
                </button>
              </div>
            )}
          </section>
        )}

        <div className="rounded-3xl border border-slate-200 dark:border-indigo-950 bg-white dark:bg-[#0D1326] p-6 space-y-3 text-sm text-slate-600 dark:text-slate-300">
          <h2 className="font-semibold text-slate-900 dark:text-white">
            Protecting Your Anonymity
          </h2>
          <p>
            Please avoid sharing phone numbers, addresses, passwords, or personally identifying information in any question or answer.
          </p>
          <p>
            We never display emails, real names, phone numbers, or user IDs alongside any public post.
          </p>
        </div>

        <CrisisSupportBanner />
      </div>
    </Layout>
  );
}

export function ReportContentPage() {
  const navigate = useNavigate();
  const [contentType, setContentType] = useState<'question' | 'answer'>('question');
  const [contentId, setContentId] = useState('');
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Layout>
      <div className="max-w-xl mx-auto space-y-6">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
          Report Content
        </h1>
        {submitted ? (
          <div className="space-y-4">
            <SuccessConfirmation
              title="Report Submitted"
              message="Moderators will review this privately."
              primaryLabel="Back to Explore"
              onPrimary={() => navigate('/explore')}
            />
            {reason === 'Self-harm concerns' && <CrisisSupportBanner />}
          </div>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              setSubmitting(true);
              try {
                await moderationApi.submitReport({
                  contentType,
                  contentId: contentId.trim() || 'general-safety-report',
                  reason,
                  description,
                });
                setSubmitted(true);
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Unable to submit report.');
              } finally {
                setSubmitting(false);
              }
            }}
            className="rounded-3xl border border-slate-200 dark:border-indigo-950 bg-white dark:bg-[#0D1326] p-6 space-y-4"
          >
            <div className="grid grid-cols-2 gap-2">
              {(['question', 'answer'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setContentType(t)}
                  className={`min-h-[42px] rounded-xl border text-xs font-semibold capitalize cursor-pointer ${
                    contentType === t
                      ? 'border-cyan-500 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300'
                      : 'border-slate-200 dark:border-indigo-900'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={contentId}
              onChange={(e) => setContentId(e.target.value)}
              placeholder="Reference ID or URL (optional)"
              className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-indigo-900 bg-slate-50 dark:bg-[#070B19] px-3.5 text-sm"
            />
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-indigo-900 bg-slate-50 dark:bg-[#070B19] px-3.5 text-sm"
            >
              {REPORT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what happened..."
              className="w-full rounded-xl border border-slate-300 dark:border-indigo-900 bg-slate-50 dark:bg-[#070B19] p-3.5 text-sm"
            />
            {error && <p className="text-sm text-rose-500">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[44px] rounded-xl bg-cyan-600 dark:bg-cyan-500 text-sm font-semibold text-white dark:text-slate-950 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Submitting...' : 'Submit Report'}
            </button>
          </form>
        )}
      </div>
    </Layout>
  );
}

export function HelpSupportPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const faqs = [
    {
      q: 'Is my identity ever shown when I ask or answer?',
      a: 'No. Emails, real names, private aliases, and account IDs are strictly private and never returned on public questions or answers.',
    },
    {
      q: 'What is One Voice?',
      a: 'One Voice lets you ask a question that receives a single, unhurried response from one stranger without public replies or competition.',
    },
    {
      q: 'How are answers ordered?',
      a: 'We prioritize relevance, unanswered questions needing perspective, and thoughtful context—never follower counts or popularity contests.',
    },
    {
      q: 'Is Stranger’s Wisdom a medical or crisis service?',
      a: 'No. Stranger’s Wisdom is for peer reflection and shared human perspective, and is not a substitute for medical, legal, mental-health, or emergency care.',
    },
  ];

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white">
            Help & Support
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Community guidelines, safety resources, and answers to common questions.
          </p>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-indigo-950 rounded-3xl border border-slate-200 dark:border-indigo-950 bg-white dark:bg-[#0D1326] overflow-hidden">
          {faqs.map((item, idx) => (
            <div key={item.q} className="p-5">
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full flex items-center justify-between text-left text-sm font-semibold text-slate-900 dark:text-white cursor-pointer"
              >
                <span>{item.q}</span>
                <ChevronRight
                  className={`h-4 w-4 text-slate-400 transition-transform ${
                    openFaq === idx ? 'rotate-90' : ''
                  }`}
                />
              </button>
              {openFaq === idx && (
                <p className="mt-2.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {item.a}
                </p>
              )}
            </div>
          ))}
        </div>

        <CrisisSupportBanner />

        <div className="rounded-3xl border border-slate-200 dark:border-indigo-950 bg-white dark:bg-[#0D1326] p-6 space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <h2 className="font-semibold text-slate-900 dark:text-white">
            Community Guidelines
          </h2>
          <p>
            Speak to strangers with the honesty and gentleness you wish someone had offered you. Harassment, hate speech, threats, spam, and sharing personal identifying details are prohibited.
          </p>
          <p className="pt-2 text-xs text-slate-500 dark:text-slate-400">
            Support contact: support@strangerswisdom.app
          </p>
        </div>
      </div>
    </Layout>
  );
}
