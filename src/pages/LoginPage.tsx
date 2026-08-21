import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Gift,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { supabase } from '../utils/supabaseCheckin';
import { resolvePostAuthDestination } from '../utils/authNavigation';

type Notice = { kind: 'error' | 'success'; message: string } | null;

const getFriendlyAuthError = (message: string): string => {
  if (/invalid login credentials/i.test(message)) return '邮箱或密码错误，请重新输入';
  if (/user already registered/i.test(message)) return '该邮箱已经注册，请直接登录';
  if (/password/i.test(message) && /least/i.test(message)) return '密码强度不足，请至少输入 8 位';
  return message || '操作失败，请稍后重试';
};

const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedMode = searchParams.get('mode');
  const destination = resolvePostAuthDestination(searchParams.get('next'));

  const [isSignUp, setIsSignUp] = useState(
    searchParams.get('view') === 'signup' || selectedMode === 'wheel' || selectedMode === 'rolling',
  );
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (active && data.user) navigate(destination, { replace: true });
    });
    return () => { active = false; };
  }, [destination, navigate]);

  const resetNotice = () => setNotice(null);

  const switchMode = (signUp: boolean) => {
    setIsSignUp(signUp);
    setPassword('');
    setConfirmPassword('');
    resetNotice();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = name.trim();

    if (!normalizedEmail || !password || (isSignUp && !normalizedName)) {
      setNotice({ kind: 'error', message: '请完整填写账号信息' });
      return;
    }
    if (isSignUp && password.length < 8) {
      setNotice({ kind: 'error', message: '密码至少需要 8 位字符' });
      return;
    }
    if (isSignUp && password !== confirmPassword) {
      setNotice({ kind: 'error', message: '两次输入的密码不一致' });
      return;
    }

    setLoading(true);
    resetNotice();

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: { data: { name: normalizedName } },
        });
        if (error) throw error;

        await supabase.auth.signOut();
        setEmail(normalizedEmail);
        setPassword('');
        setConfirmPassword('');
        setIsSignUp(false);
        setNotice({ kind: 'success', message: '注册成功，请使用新账号登录' });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (error) throw error;
        navigate(destination, { replace: true });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '操作失败，请稍后重试';
      setNotice({ kind: 'error', message: getFriendlyAuthError(message) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="vip-ui relative min-h-screen overflow-y-auto bg-[#f5f5f7] text-[#1d1d1f] selection:bg-[#3b82f6]/20">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-24 -top-32 h-[36rem] w-[36rem] rounded-full bg-[radial-gradient(circle,rgba(120,196,255,0.30),rgba(120,196,255,0)_68%)]" />
        <div className="absolute -bottom-48 right-[-6rem] h-[42rem] w-[42rem] rounded-full bg-[radial-gradient(circle,rgba(180,220,255,0.32),rgba(180,220,255,0)_68%)]" />
        <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,.65)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.65)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent_80%)]" />
      </div>

      <div className="relative mx-auto grid min-h-screen w-full max-w-[1180px] items-center gap-8 px-5 py-8 lg:grid-cols-[1.08fr_.92fr] lg:px-8">
        <section className="hidden min-h-[680px] overflow-hidden rounded-[32px] border border-white/80 bg-white/55 shadow-[0_30px_90px_rgba(31,62,92,0.13)] backdrop-blur-3xl lg:flex lg:flex-col">
          <div className="flex h-14 items-center gap-2 border-b border-black/[0.055] px-5">
            <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
            <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
            <span className="h-3 w-3 rounded-full bg-[#28c840]" />
            <span className="ml-4 text-xs font-medium tracking-wide text-[#86868b]">LUCK DRAW STUDIO</span>
          </div>

          <div className="flex flex-1 flex-col justify-between p-10 xl:p-12">
            <div>
              <div className="mb-8 inline-flex h-14 w-14 items-center justify-center rounded-[18px] bg-[#3b82f6] text-white shadow-[0_14px_30px_rgba(59,130,246,.25)]">
                <Sparkles size={27} strokeWidth={1.8} aria-hidden="true" />
              </div>
              <p className="mb-3 text-sm font-semibold text-[#2563eb]">活动管理工作台</p>
              <h1 className="max-w-xl text-[42px] font-semibold leading-[1.08] tracking-[-1.8px] text-[#1d1d1f]">
                从签到到开奖，<br />在一个清晰的工作区完成。
              </h1>
              <p className="mt-6 max-w-lg text-[17px] leading-7 text-[#6e6e73]">
                创建活动、开放签到、实时查看抽奖池，并在舞台大屏上完成公平开奖。
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { icon: UsersRound, label: '实时签到', value: '名单同步' },
                { icon: Gift, label: '双模式', value: '转盘 / 轮动' },
                { icon: ShieldCheck, label: '账号保护', value: '管理端门禁' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="rounded-2xl border border-black/[0.055] bg-white/70 p-4 shadow-[0_10px_25px_rgba(15,23,42,.04)]">
                  <Icon className="mb-5 text-[#3b82f6]" size={20} strokeWidth={1.8} aria-hidden="true" />
                  <p className="text-xs font-medium text-[#86868b]">{label}</p>
                  <p className="mt-1 text-sm font-semibold text-[#1d1d1f]">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[470px] rounded-[30px] border border-white/90 bg-white/[.82] p-6 shadow-[0_30px_80px_rgba(31,62,92,0.14)] backdrop-blur-3xl sm:p-9">
          <div className="mb-8 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3 rounded-xl focus:outline-none focus-visible:ring-4 focus-visible:ring-[#0071e3]/20">
              <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-[#3b82f6] text-white shadow-[0_10px_24px_rgba(59,130,246,.24)]">
                <Sparkles size={21} aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-semibold tracking-[-.2px]">抽奖签到系统</span>
                <span className="block text-[11px] font-medium tracking-[.12em] text-[#86868b]">LUCK DRAW</span>
              </span>
            </Link>
            {selectedMode && (
              <span className="rounded-full bg-[#eff6ff] px-3 py-1.5 text-xs font-semibold text-[#2563eb]">
                {selectedMode === 'rolling' ? '轮动式' : '转盘式'}
              </span>
            )}
          </div>

          <div className="mb-7">
            <h2 className="text-[30px] font-semibold tracking-[-1px] text-[#1d1d1f]">
              {isSignUp ? '创建管理账号' : '登录账号'}
            </h2>
            <p className="mt-2 text-[15px] leading-6 text-[#6e6e73]">
              {isSignUp ? '注册后即可创建活动，无需验证邮箱。' : '继续管理你的活动、签到和抽奖。'}
            </p>
          </div>

          <div className="mb-6 grid grid-cols-2 rounded-xl bg-[#f0f0f2] p-1" aria-label="账号操作">
            <button type="button" aria-label="切换到登录" onClick={() => switchMode(false)} className={`rounded-[9px] px-3 py-2.5 text-sm font-semibold transition-all ${!isSignUp ? 'bg-white text-[#1d1d1f] shadow-[0_2px_8px_rgba(0,0,0,.08)]' : 'text-[#6e6e73]'}`}>
              登录
            </button>
            <button type="button" aria-label="切换到注册" onClick={() => switchMode(true)} className={`rounded-[9px] px-3 py-2.5 text-sm font-semibold transition-all ${isSignUp ? 'bg-white text-[#1d1d1f] shadow-[0_2px_8px_rgba(0,0,0,.08)]' : 'text-[#6e6e73]'}`}>
              注册
            </button>
          </div>

          {notice && (
            <div role={notice.kind === 'error' ? 'alert' : 'status'} className={`mb-5 flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm ${notice.kind === 'success' ? 'border-[#34c759]/20 bg-[#effbf2] text-[#187a32]' : 'border-[#ff3b30]/20 bg-[#fff2f1] text-[#b42318]'}`}>
              {notice.kind === 'success' ? <Check className="mt-0.5 shrink-0" size={16} /> : <ShieldCheck className="mt-0.5 shrink-0" size={16} />}
              <span>{notice.message}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {isSignUp && (
              <label className="block text-sm font-medium text-[#3a3a3c]" htmlFor="auth-name">
                姓名
                <span className="relative mt-2 block">
                  <UserRound className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#86868b]" size={18} aria-hidden="true" />
                  <input id="auth-name" autoComplete="name" value={name} onChange={(event) => { setName(event.target.value); resetNotice(); }} className="h-12 w-full rounded-xl border border-[#d2d2d7] bg-white pl-11 pr-4 text-[16px] text-[#1d1d1f] outline-none transition focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/10" placeholder="你的姓名" />
                </span>
              </label>
            )}

            <label className="block text-sm font-medium text-[#3a3a3c]" htmlFor="auth-email">
              邮箱
              <span className="relative mt-2 block">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#86868b]" size={18} aria-hidden="true" />
                <input id="auth-email" type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); resetNotice(); }} className="h-12 w-full rounded-xl border border-[#d2d2d7] bg-white pl-11 pr-4 text-[16px] text-[#1d1d1f] outline-none transition focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/10" placeholder="name@company.com" />
              </span>
            </label>

            <label className="block text-sm font-medium text-[#3a3a3c]" htmlFor="auth-password">
              密码
              <span className="relative mt-2 block">
                <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#86868b]" size={18} aria-hidden="true" />
                <input id="auth-password" type={showPassword ? 'text' : 'password'} autoComplete={isSignUp ? 'new-password' : 'current-password'} value={password} onChange={(event) => { setPassword(event.target.value); resetNotice(); }} className="h-12 w-full rounded-xl border border-[#d2d2d7] bg-white pl-11 pr-12 text-[16px] text-[#1d1d1f] outline-none transition focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/10" placeholder={isSignUp ? '至少 8 位字符' : '输入密码'} />
                <button type="button" aria-label={showPassword ? '隐藏密码' : '显示密码'} onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-[#86868b] transition hover:bg-[#f0f0f2] hover:text-[#1d1d1f] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#0071e3]/15">
                  {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                </button>
              </span>
            </label>

            {isSignUp && (
              <label className="block text-sm font-medium text-[#3a3a3c]" htmlFor="auth-password-confirm">
                确认密码
                <span className="relative mt-2 block">
                  <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#86868b]" size={18} aria-hidden="true" />
                  <input id="auth-password-confirm" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); resetNotice(); }} className="h-12 w-full rounded-xl border border-[#d2d2d7] bg-white pl-11 pr-4 text-[16px] text-[#1d1d1f] outline-none transition focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/10" placeholder="再次输入密码" />
                </span>
              </label>
            )}

            <button type="submit" disabled={loading} className="vip-button-primary group mt-2 flex h-12 w-full items-center justify-center gap-2 px-5 text-[15px] font-semibold text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-[#3b82f6]/25">
              {loading ? <LoaderCircle className="animate-spin" size={19} aria-hidden="true" /> : <>{isSignUp ? '创建账号' : '登录'}<ArrowRight className="transition-transform group-hover:translate-x-0.5" size={17} aria-hidden="true" /></>}
            </button>
          </form>

          <p className="mt-6 text-center text-xs leading-5 text-[#86868b]">
            {isSignUp ? '账号用于管理活动，不影响参会者通过链接签到。' : '登录后将返回刚才选择的抽奖模式。'}
          </p>
        </section>
      </div>

      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .transition, [class*="transition-"] { transition-duration: 0.01ms !important; }
          .animate-spin { animation-duration: 0.01ms !important; }
        }
      `}</style>
    </main>
  );
};

export default LoginPage;
