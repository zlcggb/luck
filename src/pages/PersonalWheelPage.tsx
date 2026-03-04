import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, Loader2, CheckCircle2, MapPin, Sparkles } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  LuckCheckIn,
  LuckPrize,
  LuckWinner,
  createWinner,
  getCheckInByEmployee,
  getEvent,
  getPrizes,
  getWinners,
} from '../utils/supabaseCheckin';

// ==========================================
// 🎨 品牌定制配置区 (浅色欧式复古系)
// ==========================================
const BRAND_CONFIG = {
  primaryColor: "#003cff",
  secondaryColor: "#00cb35",
  accentColor: "#ff1e00",
  eventName: "ISLE 2026 展会抽奖"
};

// --- SVG 数学计算工具 ---
const polarToCartesian = (cx: number, cy: number, r: number, angleInDegrees: number) => {
  const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
  return {
    x: Math.round((cx + r * Math.cos(angleInRadians)) * 100) / 100,
    y: Math.round((cy + r * Math.sin(angleInRadians)) * 100) / 100
  };
};

const createSlice = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return [
    "M", cx, cy,
    "L", start.x, start.y,
    "A", r, r, 0, largeArcFlag, 1, end.x, end.y,
    "Z"
  ].join(" ");
};

const createTextArc = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
};

const SPIN_DURATION_MS = 6000;

const pickWeightedPrize = (pool: LuckPrize[]): LuckPrize | null => {
  const totalWeight = pool.reduce((sum, prize) => sum + Math.max(prize.remaining, 0), 0);
  if (totalWeight <= 0) return null;

  let random = Math.random() * totalWeight;
  for (const prize of pool) {
    random -= Math.max(prize.remaining, 0);
    if (random <= 0) return prize;
  }
  return pool[pool.length - 1] || null;
};

const PersonalWheelPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('event');
  const employeeId = searchParams.get('employee');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [eventName, setEventName] = useState(BRAND_CONFIG.eventName);
  const [checkInRecord, setCheckInRecord] = useState<LuckCheckIn | null>(null);
  const [availablePrizes, setAvailablePrizes] = useState<LuckPrize[]>([]);
  const [winner, setWinner] = useState<LuckWinner | null>(null);
  const [step, setStep] = useState(0); // 0=loading, 1=wheel, 2=result

  useEffect(() => {
    let active = true;
    const init = async () => {
      if (!eventId || !employeeId) {
        setError('参数不完整，请返回重新扫码');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const [event, checkIn, prizes, winners] = await Promise.all([
          getEvent(eventId),
          getCheckInByEmployee(eventId, employeeId),
          getPrizes(eventId),
          getWinners(eventId),
        ]);
        if (!active) return;
        if (!event) { setError('活动已失效'); setLoading(false); return; }
        if (!checkIn) { setError('请先完成访客登记'); setLoading(false); return; }

        const activePrizes = prizes.filter((p) => p.is_active && p.remaining > 0);
        const existingWinner = winners.find((w) => w.employee_id === employeeId) || null;

        setEventName(event.name);
        setCheckInRecord(checkIn);
        setAvailablePrizes(activePrizes);
        setWinner(existingWinner);

        if (existingWinner) {
          setStep(2);
        } else {
          setStep(1);
          if (activePrizes.length === 0) setError('当前奖池已空，请稍后再试');
        }
      } catch {
        if (active) setError('加载网络超时，请重试');
      } finally {
        if (active) setLoading(false);
      }
    };
    init();
    return () => { active = false; };
  }, [employeeId, eventId]);

  const handleDraw = async () => {
    if (!eventId || !employeeId || !checkInRecord || winner || isSpinning || availablePrizes.length === 0) return;

    const chosen = pickWeightedPrize(availablePrizes);
    if (!chosen) { setActionError('奖池已空'); return; }

    setActionError('');
    setIsSpinning(true);

    const sliceAngle = 360 / availablePrizes.length;
    const targetIndex = availablePrizes.findIndex((p) => p.id === chosen.id);
    const newRotation = rotation + (360 * 8) - (rotation % 360) - (targetIndex * sliceAngle);
    setRotation(newRotation);

    setTimeout(async () => {
      try {
        const latestWinners = await getWinners(eventId);
        const existingWinner = latestWinners.find((w) => w.employee_id === employeeId) || null;
        if (existingWinner) {
          setWinner(existingWinner);
          setIsSpinning(false);
          setStep(2);
          return;
        }

        const latestPrizes = (await getPrizes(eventId)).filter((p) => p.is_active && p.remaining > 0);
        if (latestPrizes.length === 0) {
          setActionError('奖池已空');
          setIsSpinning(false);
          return;
        }

        const finalPrize =
          latestPrizes.find((p) => p.id === chosen.id && p.remaining > 0) ||
          pickWeightedPrize(latestPrizes);

        if (!finalPrize) { setActionError('奖池已空'); setIsSpinning(false); return; }

        const createdWinner = await createWinner(eventId, finalPrize.id, {
          participant_id: undefined,
          employee_id: employeeId,
          name: checkInRecord.name,
          department: checkInRecord.department || undefined,
          avatar: checkInRecord.avatar || undefined,
        });
        if (!createdWinner) throw new Error('保存失败');

        const winnerWithPrize: LuckWinner = { ...createdWinner, prize: finalPrize };
        setWinner(winnerWithPrize);
        setAvailablePrizes((prev) =>
          prev
            .map((p) => p.id === finalPrize.id ? { ...p, remaining: Math.max(p.remaining - 1, 0) } : p)
            .filter((p) => p.remaining > 0)
        );
        setStep(2);
      } catch {
        setActionError('网络超时，未保存');
      } finally {
        setIsSpinning(false);
      }
    }, SPIN_DURATION_MS);
  };

  const prizeDisplayList = useMemo(() => availablePrizes, [availablePrizes]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-[#003cff]/40 animate-spin" />
      </div>
    );
  }

  // Error state
  if (error && step === 0) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center p-6">
        <div className="bg-white/60 backdrop-blur-xl p-8 rounded-2xl border border-[#003cff]/10 max-w-sm w-full text-center" style={{ boxShadow: '0 15px 40px -5px rgba(0,60,255,0.08)' }}>
          <AlertCircle className="w-12 h-12 text-[#ff1e00] mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[#1a2332] mb-2" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>出错了</h2>
          <p className="text-[#64748b] text-sm mb-6">{error}</p>
          <button
            onClick={() => navigate(eventId ? `/lottery/employee?event=${eventId}` : '/lottery/employee')}
            className="w-full bg-[#003cff] text-white py-4 rounded tracking-[0.2em] hover:bg-[#0028aa] transition-all"
            style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
          >
            返回重新扫码
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#FDFBF7] text-[#2c3e50] overflow-hidden relative flex flex-col" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>

      {/* 欧式古典暗纹背景 */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{ backgroundImage: 'radial-gradient(#003cff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

      {/* 极柔和的弥散光 */}
      <div className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] rounded-full blur-[120px] pointer-events-none opacity-[0.08] bg-gradient-to-br from-[#003cff] to-transparent" />

      <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-4 py-8 relative z-10">
        <div className="w-full max-w-md">

          {/* STEP 1: 幸运转盘 */}
          <div className={`transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${step === 1 ? 'opacity-100 translate-y-0 relative z-10' : 'opacity-0 translate-y-10 absolute pointer-events-none'}`}>
            <div className="text-center mb-4 mt-4">
              <h1 className="text-2xl sm:text-3xl font-black tracking-wider text-[#1a2332]" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
                展会幸运抽奖
              </h1>
              <div className="flex items-center justify-center gap-2 opacity-60 mt-3">
                <span className="w-6 h-[1px] bg-[#003cff]" />
                <p className="text-[#003cff] text-[10px] tracking-[0.15em] uppercase whitespace-nowrap" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>Welcome · {checkInRecord?.name}</p>
                <span className="w-6 h-[1px] bg-[#003cff]" />
              </div>
            </div>

            <div className="flex justify-center relative my-6 scale-[0.95] sm:scale-[1.1]">

              {/* 指针 */}
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center" style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.15))' }}>
                <div className="w-3 h-3 rounded-full border-[3px] border-[#003cff] bg-white z-10 relative top-2" />
                <div className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[35px] border-t-[#003cff] relative" style={{ zIndex: 0 }} />
              </div>

              {/* 转盘容器 */}
              <div className="relative w-[320px] h-[320px] rounded-full bg-[#fdfdfc] border-[8px] border-white flex items-center justify-center overflow-hidden ring-1 ring-[#003cff]/10"
                style={{ boxShadow: '0 15px 40px rgba(0,30,100,0.15)' }}>

                {/* 静态复古纹理底盘 */}
                <div className="absolute inset-0 rounded-full border border-[#003cff]/20 pointer-events-none m-2" />
                <div className="absolute inset-0 rounded-full border border-dashed border-[#003cff]/30 pointer-events-none m-4" />

                {/* 旋转层 */}
                <div
                  className="w-full h-full rounded-full absolute inset-0"
                  style={{
                    transform: `rotate(${rotation}deg)`,
                    transitionDuration: isSpinning ? '6s' : '0s',
                    transitionTimingFunction: 'cubic-bezier(0.25, 1, 0.4, 1)',
                    transitionProperty: 'transform',
                  }}
                >
                  <svg width="100%" height="100%" viewBox="0 0 320 320">
                    {prizeDisplayList.map((p, i) => {
                      const sliceAngle = 360 / prizeDisplayList.length;
                      const startAngle = (i * sliceAngle) - 90 - (sliceAngle / 2);
                      const endAngle = startAngle + sliceAngle;
                      const pathData = createSlice(160, 160, 160, startAngle, endAngle);
                      const textArcData = createTextArc(160, 160, 132, startAngle, endAngle);
                      const isEven = i % 2 === 0;
                      const fill = isEven ? '#ffffff' : '#f5f8ff';

                      return (
                        <g key={p.id}>
                          <path d={pathData} fill={fill} stroke="#003cff" strokeWidth="0.5" strokeOpacity="0.2" />
                          <path id={`text-arc-${i}`} d={textArcData} fill="none" />
                          <text
                            fill="#003cff"
                            fontSize="13"
                            fontWeight="bold"
                            letterSpacing="2"
                            fontFamily="Georgia, serif"
                          >
                            <textPath href={`#text-arc-${i}`} startOffset="50%" textAnchor="middle">
                              {p.name}
                            </textPath>
                          </text>
                          <g transform={`translate(160, 160) rotate(${i * sliceAngle - 90})`}>
                            <circle cx="100" cy="0" r="2.5" fill="#003cff" opacity="0.4" />
                            <path d="M70,0 L75,-2 L80,0 L75,2 Z" fill="#003cff" opacity="0.2" />
                          </g>
                        </g>
                      );
                    })}
                  </svg>
                </div>

                {/* 中心控制核心 */}
                <button
                  onClick={handleDraw}
                  disabled={isSpinning || !!winner || availablePrizes.length === 0}
                  className="absolute w-20 h-20 bg-white rounded-full z-20 flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:scale-100 disabled:opacity-90 border-[4px] border-[#f0f4ff] group"
                  style={{ boxShadow: '0 10px 20px rgba(0,30,100,0.15)' }}
                >
                  <div className="w-14 h-14 rounded-full bg-[#003cff] flex flex-col items-center justify-center relative overflow-hidden" style={{ boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.4)' }}>
                    <div className="absolute top-0 left-0 w-full h-1/2 bg-white/20 rounded-t-full pointer-events-none" />
                    <Sparkles className="w-5 h-5 text-white mb-0.5" strokeWidth={1.5} />
                    <span className="text-white text-[9px] tracking-[0.2em] uppercase mt-1" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
                      {isSpinning ? '...' : 'Spin'}
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* 错误提示 */}
            {actionError && (
              <p className="text-center text-[#ff1e00] text-xs mt-4">{actionError}</p>
            )}
          </div>

          {/* STEP 2: 欧式典藏凭证 */}
          <div className={`w-full transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${step === 2 ? 'opacity-100 translate-y-0 relative z-10' : 'opacity-0 translate-y-10 absolute pointer-events-none'}`}>
            {step === 2 && winner && (
              <div className="space-y-6" style={{ animation: 'fade-in-up 1s ease-out' }}>
                <div className="text-center space-y-3 mb-8">
                  <div className="w-14 h-14 border border-[#00cb35] rounded-full flex items-center justify-center mx-auto mb-4 bg-white" style={{ boxShadow: '0 2px 10px rgba(0,203,53,0.15)' }}>
                    <CheckCircle2 className="w-8 h-8 text-[#00cb35]" strokeWidth={1.5} />
                  </div>
                  <h2 className="text-2xl font-bold tracking-widest text-[#1a2332]" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>幸运转盘</h2>
                  <p className="text-[#003cff]/70 text-xs mt-3 tracking-[0.2em]" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>TOUCH THE CENTER TO SPIN</p>
                </div>

                {/* 奖品凭证 */}
                <div className="bg-white rounded-md p-1.5 relative overflow-hidden" style={{ boxShadow: '0 20px 50px -10px rgba(0,30,80,0.15)' }}>
                  <div className="bg-[#fdfbf7] border border-[#003cff]/20 h-full relative p-6">
                    {/* 四角复古装饰 */}
                    <div className="absolute top-2 left-2 text-[#003cff]/30 text-lg leading-none" style={{ fontFamily: 'serif' }}>+</div>
                    <div className="absolute top-2 right-2 text-[#003cff]/30 text-lg leading-none" style={{ fontFamily: 'serif' }}>+</div>
                    <div className="absolute bottom-2 left-2 text-[#003cff]/30 text-lg leading-none" style={{ fontFamily: 'serif' }}>+</div>
                    <div className="absolute bottom-2 right-2 text-[#003cff]/30 text-lg leading-none" style={{ fontFamily: 'serif' }}>+</div>

                    <div className="flex flex-col items-center justify-center border-b border-[#003cff]/10 pb-6 mb-6 relative mt-2">
                      <p className="text-[#94a3b8] text-[10px] uppercase tracking-[0.3em] mb-3" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>ISLE 2026 · Prize Certificate</p>
                      <h3 className="text-2xl font-bold text-center text-[#003cff] tracking-wide" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
                        {winner.prize?.name || '神秘奖品'}
                      </h3>
                    </div>

                    <div className="space-y-4 px-2 text-sm text-[#475569]" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
                      <div className="flex justify-between items-end border-b border-dashed border-[#e2e8f0] pb-2">
                        <span className="text-[#94a3b8] text-xs italic">获奖者 Name</span>
                        <span className="font-bold text-[#1e293b] text-base">{winner.name}</span>
                      </div>
                      <div className="flex justify-between items-end border-b border-dashed border-[#e2e8f0] pb-2">
                        <span className="text-[#94a3b8] text-xs italic">手机尾号 Phone</span>
                        <span className="font-bold text-[#003cff] text-base">{winner.employee_id?.slice(-4)}</span>
                      </div>
                    </div>

                    {/* 真实可扫描二维码区域 */}
                    {(() => {
                      const redeemCode = `ISLE2026-${winner.id?.slice(-8).toUpperCase()}`;
                      return (
                        <div className="mt-8 flex flex-col items-center">
                          <p className="text-[#94a3b8] text-[9px] uppercase tracking-[0.25em] mb-3" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>扫码核销</p>
                          <div
                            className="bg-white p-3 border border-[#003cff]/15"
                            style={{ boxShadow: '0 2px 12px rgba(0,60,255,0.08)' }}
                          >
                            <QRCodeSVG
                              value={redeemCode}
                              size={148}
                              bgColor="#ffffff"
                              fgColor="#1e293b"
                              level="M"
                              marginSize={0}
                            />
                          </div>
                          {/* 兑换码明文 */}
                          <div className="mt-4 px-4 py-2 bg-[#f0f4ff] border border-[#003cff]/10 rounded">
                            <p className="text-[#003cff] text-xs font-bold tracking-[0.15em] select-all text-center" style={{ fontFamily: 'monospace' }}>
                              {redeemCode}
                            </p>
                          </div>
                          <p className="text-center text-[#c0c8d8] text-[9px] mt-3 tracking-[0.2em] uppercase">请出示此码至服务处兑换</p>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div className="flex items-start gap-3 mt-6 text-[#94a3b8] px-2">
                  <MapPin className="w-5 h-5 shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
                    请截图保存此页面，并携带本人手机前往<span className="text-[#003cff] font-bold">展台服务处</span>凭码兑换奖品。
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 页脚品牌落款 */}
      <div className="shrink-0 py-4 flex flex-col items-center gap-1.5 relative z-10" style={{ opacity: 0.5 }}>
        <img src="/logo_24.svg" alt="Unilumin" className="h-6" />
        <p
          className="text-[#003cff] text-[9px] tracking-[0.2em] uppercase whitespace-nowrap"
          style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
        >
          {eventName}
        </p>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&display=swap');
        @keyframes fade-in-up {
          0% { opacity: 0; transform: translateY(20px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}} />
    </div>
  );
};

export default PersonalWheelPage;
