import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { LoaderCircle, Sparkles } from 'lucide-react';
import { supabase } from '../../utils/supabaseCheckin';
import { buildLoginRedirect } from '../../utils/authNavigation';

type AuthState = 'checking' | 'authenticated' | 'anonymous';

const RequireAuth = () => {
  const location = useLocation();
  const [authState, setAuthState] = useState<AuthState>('checking');

  useEffect(() => {
    let mounted = true;

    void supabase.auth.getUser().then(({ data }) => {
      if (mounted) setAuthState(data.user ? 'authenticated' : 'anonymous');
    });

    const subscription = supabase.auth.onAuthStateChange?.((_event, session) => {
      if (mounted) setAuthState(session?.user ? 'authenticated' : 'anonymous');
    }).data.subscription;

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  if (authState === 'checking') {
    return (
      <main className="vip-ui flex min-h-screen items-center justify-center bg-[#f5f5f7] text-[#1d1d1f]">
        <div className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white/80 px-5 py-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
          <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-[#3b82f6] text-white">
            <Sparkles size={17} aria-hidden="true" />
          </span>
          <span className="text-sm font-medium text-[#6e6e73]">正在验证登录状态</span>
          <LoaderCircle className="animate-spin text-[#3b82f6]" size={17} aria-hidden="true" />
        </div>
      </main>
    );
  }

  if (authState === 'anonymous') {
    const currentPath = `${location.pathname}${location.search}`;
    return <Navigate to={buildLoginRedirect(currentPath)} replace />;
  }

  return <Outlet />;
};

export default RequireAuth;
