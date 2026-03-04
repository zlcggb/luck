import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowRight, ScanLine, UserRoundSearch } from 'lucide-react';

const LotteryGuidePage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const eventId = searchParams.get('event');

  /**
   * 转盘式入口逻辑：
   * - 有 event 参数：访客直接进入对应活动的转盘页
   * - 无 event 参数：管理员流程，先登录再选项目
   */
  const handleWheelClick = () => {
    if (eventId) {
      navigate(`/lottery/wheel?event=${encodeURIComponent(eventId)}`);
    } else {
      // 无活动 ID → 走管理员流程（登录 → 项目列表 → 选项目）
      navigate('/projects');
    }
  };

  /**
   * 轮动式入口逻辑：
   * - 保持原有行为，无需登录，直接进入
   */
  const rollingTo = eventId
    ? `/lottery/rolling?event=${encodeURIComponent(eventId)}`
    : '/lottery/rolling';

  return (
    <div
      className="relative min-h-screen overflow-auto bg-[#FDFBF7] text-[#2c3e50] flex flex-col items-center justify-center p-6"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
    >
      {/* 欧式古典暗纹背景 */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.04]"
        style={{ backgroundImage: 'radial-gradient(#003cff 1px, transparent 1px)', backgroundSize: '24px 24px' }}
      />
      {/* 极柔和弥散光 */}
      <div className="fixed top-[-10%] left-[-10%] w-[60vw] h-[60vw] rounded-full blur-[120px] pointer-events-none opacity-[0.08] bg-gradient-to-br from-[#003cff] to-transparent" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full blur-[100px] pointer-events-none opacity-[0.05] bg-gradient-to-tl from-[#003cff] to-transparent" />

      <div className="relative z-10 w-full max-w-4xl flex flex-col items-center">

        {/* 顶部标题区 */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-6 opacity-60">
            <span className="w-10 h-[1px] bg-[#003cff]" />
            <p
              className="text-[#003cff] text-[10px] tracking-[0.4em] uppercase"
              style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
            >
              ISLE 2026 · LED Display Exhibition
            </p>
            <span className="w-10 h-[1px] bg-[#003cff]" />
          </div>

          <h1
            className="text-4xl md:text-5xl font-black tracking-wider text-[#1a2332] mb-4"
            style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
          >
            光显展区抽奖
          </h1>
          <p className="text-[#64748b] text-sm tracking-wide">
            请选择您的参与方式
          </p>
        </div>

        {/* 入口卡片 — 始终展示两种模式 */}
        <div className="grid w-full gap-6 md:grid-cols-2">

          {/* 转盘式入口 */}
          <button
            onClick={handleWheelClick}
            className="group flex flex-col h-full justify-between rounded-2xl p-8 bg-white/60 backdrop-blur-xl border border-[#003cff]/10 transition-all duration-300 hover:-translate-y-1 hover:bg-white/80 text-left"
            style={{ boxShadow: '0 15px 40px -5px rgba(0,60,255,0.08), 0 0 0 1px rgba(0,60,255,0.05)' }}
          >
            <div>
              <div
                className="mb-6 inline-flex rounded-xl bg-[#003cff]/5 border border-[#003cff]/10 p-4 text-[#003cff]"
              >
                <ScanLine size={28} strokeWidth={1.5} />
              </div>
              <h2
                className="text-2xl font-bold tracking-tight mb-3 text-[#1a2332]"
                style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
              >
                转盘式抽奖
              </h2>
              <p className="text-sm text-[#64748b] leading-relaxed">
                填写信息后转动幸运转盘，即时获得抽奖结果，可生成核销凭证。适合展会现场单人参与。
              </p>
              {!eventId && (
                <p className="text-xs text-[#003cff]/60 mt-3 flex items-center gap-1">
                  需要管理员登录以创建或管理项目
                </p>
              )}
            </div>
            <div
              className="mt-8 inline-flex items-center gap-2 text-xs font-bold text-[#003cff] uppercase tracking-widest"
              style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
            >
              ENTER WHEEL
              <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
            </div>
          </button>

          {/* 轮动式入口 */}
          <Link
            to={rollingTo}
            className="group flex flex-col h-full justify-between rounded-2xl p-8 bg-white/60 backdrop-blur-xl border border-[#003cff]/10 transition-all duration-300 hover:-translate-y-1 hover:bg-white/80"
            style={{ boxShadow: '0 15px 40px -5px rgba(0,60,255,0.08), 0 0 0 1px rgba(0,60,255,0.05)' }}
          >
            <div>
              <div
                className="mb-6 inline-flex rounded-xl bg-[#003cff]/5 border border-[#003cff]/10 p-4 text-[#003cff]"
              >
                <UserRoundSearch size={28} strokeWidth={1.5} />
              </div>
              <h2
                className="text-2xl font-bold tracking-tight mb-3 text-[#1a2332]"
                style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
              >
                滚动式抽奖
              </h2>
              <p className="text-sm text-[#64748b] leading-relaxed">
                全屏滚动名单大屏展示，保持原有抽奖逻辑，适合舞台大屏、集中开奖等大规模人流场景。
              </p>
            </div>
            <div
              className="mt-8 inline-flex items-center gap-2 text-xs font-bold text-[#003cff] uppercase tracking-widest"
              style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
            >
              ENTER ROLLING
              <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        </div>

        {/* 底部注释 */}
        <p
          className="mt-12 text-[#94a3b8] text-[10px] tracking-[0.3em] uppercase opacity-60"
          style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
        >
          Powered by ISLE 2026 LED Display Exhibition
        </p>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&display=swap');
      ` }} />
    </div>
  );
};

export default LotteryGuidePage;
