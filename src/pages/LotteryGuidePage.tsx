import { ArrowRight, CircleUserRound, ScanLine, Sparkles, UserRoundSearch } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { getModeDestination, type LotteryMode } from '../utils/authNavigation';

const LotteryGuidePage = () => {
  const navigate = useNavigate();
  const chooseMode = (mode: LotteryMode) => navigate(getModeDestination(mode));

  return (
    <main className="vip-ui relative min-h-screen overflow-hidden bg-[#f5f5f7] px-5 py-6 text-[#1d1d1f] sm:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[6%] top-[-12rem] h-[30rem] w-[30rem] rounded-full bg-[#3b82f6]/10 blur-3xl" />
        <div className="absolute bottom-[-14rem] right-[4%] h-[34rem] w-[34rem] rounded-full bg-[#667eea]/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl flex-col">
        <header className="vip-glass flex items-center justify-between rounded-2xl px-4 py-3 sm:px-5">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#3b82f6] text-white shadow-sm">
              <Sparkles size={18} aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold tracking-tight">幸运抽奖</p>
              <p className="text-[11px] text-[#86868b]">活动管理工作台</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium text-[#2563eb] transition-colors hover:bg-[#eff6ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6]/40"
          >
            <CircleUserRound size={17} aria-hidden="true" />
            登录或注册
          </button>
        </header>

        <section className="flex flex-1 flex-col items-center justify-center py-14 sm:py-20">
          <div className="mb-10 max-w-2xl text-center">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-[#2563eb]">Choose a draw mode</p>
            <h1 className="text-balance text-4xl font-semibold tracking-[-0.045em] sm:text-6xl">选择你的抽奖方式</h1>
            <p className="mx-auto mt-5 max-w-xl text-sm leading-6 text-[#6e6e73] sm:text-base">
              选择模式后，登录或注册管理账号，再创建活动、开放签到并开始抽奖。
            </p>
          </div>

          <div className="grid w-full max-w-4xl gap-5 md:grid-cols-2">
            <ModeCard
              icon={<ScanLine size={26} strokeWidth={1.7} aria-hidden="true" />}
              title="转盘式抽奖"
              subtitle="适合访客独立参与"
              description="创建活动二维码，参与者填写信息后转动转盘，即时显示奖品与核销凭证。"
              accent="from-[#3b82f6] to-[#60a5fa]"
              onClick={() => chooseMode('wheel')}
            />
            <ModeCard
              icon={<UserRoundSearch size={26} strokeWidth={1.7} aria-hidden="true" />}
              title="轮动式抽奖"
              subtitle="适合舞台与集中开奖"
              description="参与者填写姓名和工号完成签到后自动进入抽奖池，管理员在大屏统一开奖。"
              accent="from-[#3b82f6] to-[#667eea]"
              onClick={() => chooseMode('rolling')}
            />
          </div>

          <div className="mt-7 flex items-center gap-2 rounded-full border border-black/[0.05] bg-white/60 px-4 py-2 text-xs text-[#6e6e73] backdrop-blur-xl">
            <span className="h-1.5 w-1.5 rounded-full bg-[#34c759]" aria-hidden="true" />
            管理员需要账号；参与者通过活动签到链接加入，无需注册
          </div>
        </section>

        <footer className="pb-2 text-center text-[11px] text-[#86868b]">ISLE 2026 · Lucky Draw System</footer>
      </div>
    </main>
  );
};

interface ModeCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
  accent: string;
  onClick: () => void;
}

const ModeCard = ({ icon, title, subtitle, description, accent, onClick }: ModeCardProps) => (
  <button
    type="button"
    onClick={onClick}
    className="vip-card vip-card-interactive group relative overflow-hidden rounded-[24px] p-7 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#3b82f6]/25 motion-reduce:transform-none motion-reduce:transition-none sm:p-8"
  >
    <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accent}`} />
    <div className="mb-12 flex items-start justify-between">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f3f4f6] text-[#111827] transition-colors group-hover:bg-[#3b82f6] group-hover:text-white">
        {icon}
      </span>
      <ArrowRight className="text-[#9ca3af] transition-transform group-hover:translate-x-1 group-hover:text-[#3b82f6]" size={20} aria-hidden="true" />
    </div>
    <p className="mb-2 text-xs font-semibold text-[#86868b]">{subtitle}</p>
    <h2 className="text-2xl font-semibold tracking-[-0.025em]">{title}</h2>
    <p className="mt-3 text-sm leading-6 text-[#6e6e73]">{description}</p>
    <span className="mt-7 inline-flex rounded-xl bg-[#3b82f6] px-4 py-2 text-xs font-semibold text-white shadow-sm">登录后创建</span>
  </button>
);

export default LotteryGuidePage;
