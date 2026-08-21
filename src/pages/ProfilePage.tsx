import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, LogOut, Mail, RefreshCw, ShieldCheck, UserRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import AppearanceToggle from '../components/ui/AppearanceToggle';
import MobileBottomNav from '../components/navigation/MobileBottomNav';
import { useUiAppearance } from '../contexts/UiAppearanceContext';
import { getAuthDisplayName, getAuthInitial } from '../utils/authProfile';
import { getLastProjectId } from '../utils/mobileNavigation';
import { supabase } from '../utils/supabaseCheckin';

interface ProfileUser {
  id: string;
  email?: string | null;
  created_at?: string | null;
  user_metadata?: { name?: unknown } | null;
}

type LoadState = 'loading' | 'ready' | 'error';

const ProfilePage = () => {
  const navigate = useNavigate();
  const { appearance } = useUiAppearance();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [error, setError] = useState('');
  const [signingOut, setSigningOut] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoadState('loading');
    setError('');
    try {
      const { data, error: userError } = await supabase.auth.getUser();
      if (userError || !data.user) throw userError || new Error('missing user');
      setProfile(data.user as ProfileUser);
      setLoadState('ready');
    } catch {
      setProfile(null);
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleLogout = async () => {
    setSigningOut(true);
    setError('');
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      navigate('/login', { replace: true });
    } catch {
      setError('退出失败，请稍后重试');
    } finally {
      setSigningOut(false);
    }
  };

  const displayName = profile ? getAuthDisplayName(profile) : '';
  const joinedAt = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
    : '暂无记录';

  return (
    <div className="vip-ui admin-ui min-h-screen" data-ui-theme={appearance}>
      <header className="vip-glass sticky top-0 z-30 border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-8">
          <div className="flex items-center gap-3">
            <Link to="/projects" aria-label="返回项目列表" className="vip-icon-button grid h-11 w-11 place-items-center">
              <ArrowLeft size={20} aria-hidden="true" />
            </Link>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ui-primary)]">Account</p>
              <h1 className="text-xl font-semibold text-[var(--ui-text)]">个人信息</h1>
            </div>
          </div>
          <AppearanceToggle />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8 pb-28 sm:px-8 sm:pb-16">
        {loadState === 'loading' && (
          <div className="vip-card ui-surface flex min-h-72 items-center justify-center" aria-label="正在加载账号资料">
            <RefreshCw className="animate-spin text-[var(--ui-primary)]" size={28} />
          </div>
        )}

        {loadState === 'error' && (
          <div className="vip-card ui-surface flex min-h-72 flex-col items-center justify-center gap-4 p-8 text-center">
            <UserRound size={34} className="text-[var(--ui-text-muted)]" />
            <div>
              <h2 className="text-lg font-semibold text-[var(--ui-text)]">暂时无法加载账号资料</h2>
              <p className="mt-1 text-sm text-[var(--ui-text-muted)]">请检查网络后重新尝试。</p>
            </div>
            <button type="button" onClick={() => void loadProfile()} className="vip-button-primary px-5 py-2.5 font-medium">
              重新加载
            </button>
          </div>
        )}

        {loadState === 'ready' && profile && (
          <div className="space-y-5">
            <section className="vip-card ui-surface overflow-hidden p-6 sm:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="grid h-20 w-20 shrink-0 place-items-center rounded-3xl bg-[#2563eb] text-3xl font-semibold text-white shadow-[0_14px_34px_rgba(37,99,235,.24)]">
                  {getAuthInitial(displayName)}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-2xl font-semibold text-[var(--ui-text)]">{displayName}</h2>
                  <p className="mt-1 truncate text-sm text-[var(--ui-text-muted)]">{profile.email || '未设置邮箱'}</p>
                  <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--ui-success-soft)] px-3 py-1 text-xs font-medium text-[var(--ui-success)]">
                    <ShieldCheck size={14} aria-hidden="true" /> 已登录
                  </span>
                </div>
              </div>
            </section>

            <section className="vip-card ui-surface divide-y divide-[var(--ui-border)] px-6 sm:px-8">
              <div className="flex items-center gap-4 py-5">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--ui-primary-soft)] text-[var(--ui-primary)]"><Mail size={18} /></span>
                <div><p className="text-xs text-[var(--ui-text-muted)]">邮箱</p><p className="mt-1 font-medium text-[var(--ui-text)]">{profile.email || '未设置邮箱'}</p></div>
              </div>
              <div className="flex items-center gap-4 py-5">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--ui-primary-soft)] text-[var(--ui-primary)]"><CalendarDays size={18} /></span>
                <div><p className="text-xs text-[var(--ui-text-muted)]">注册时间</p><p className="mt-1 font-medium text-[var(--ui-text)]">{joinedAt}</p></div>
              </div>
            </section>

            {error && <p role="alert" className="rounded-xl bg-[var(--ui-danger-soft)] px-4 py-3 text-sm text-[var(--ui-danger)]">{error}</p>}
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={signingOut}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] px-5 py-3 font-medium text-[var(--ui-danger)] transition-colors hover:bg-[var(--ui-danger-soft)] disabled:opacity-50"
            >
              <LogOut size={18} aria-hidden="true" />
              {signingOut ? '正在退出…' : '退出登录'}
            </button>
          </div>
        )}
      </main>

      <MobileBottomNav active="profile" lotteryProjectId={getLastProjectId()} />
    </div>
  );
};

export default ProfilePage;
