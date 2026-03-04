import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Ticket, Gift, CheckCircle2, Settings, FileText,
  Users, LayoutDashboard, Search, Camera, X,
  Smartphone, Headphones, ShoppingBag, Coffee, Sparkles, Hexagon,
  ArrowLeft, Plus, Trash2, Edit3, Save,
  type LucideIcon
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  LuckPrize, LuckWinner,
  getPrizes, wheelDraw, checkPhoneDuplicate,
  getWinnersWithPrizes, redeemWinner, lookupByCode,
  updatePrize, createPrize, deletePrize,
  getEvent, updateProject,
} from '../utils/supabaseCheckin';



// --- SVG 数学计算工具 ---
const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: Math.round((cx + r * Math.cos(rad)) * 100) / 100,
    y: Math.round((cy + r * Math.sin(rad)) * 100) / 100,
  };
};

const createSlice = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end   = polarToCartesian(cx, cy, r, endAngle);
  const large = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y} Z`;
};

const createTextArc = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end   = polarToCartesian(cx, cy, r, endAngle);
  const large = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`;
};

// --- 奖项图标映射 ---
const IconMap: Record<string, LucideIcon> = {
  Smartphone, Headphones, ShoppingBag, Coffee, Gift, Hexagon,
};

const SPIN_DURATION = 6000;

// 表单字段配置类型
type FormField = {
  key: string;
  label: string;     // 中文标签
  labelEn: string;   // 英文标签
  type: 'text' | 'tel' | 'email';
  required: boolean;
  enabled: boolean;
  locked: boolean;
};

const DEFAULT_FORM_FIELDS: FormField[] = [
  { key: 'name',        label: '您的姓名',          labelEn: 'Full Name',              type: 'text',  required: true,  enabled: true,  locked: true },
  { key: 'phone',       label: '手机号码',          labelEn: 'Phone Number',          type: 'tel',   required: true,  enabled: true,  locked: true },
  { key: 'company',     label: '所在公司',          labelEn: 'Company',               type: 'text',  required: false, enabled: true,  locked: false },
  { key: 'email',       label: '邮箱',              labelEn: 'Email',                 type: 'email', required: false, enabled: false, locked: false },
  { key: 'wechat',      label: '微信号',            labelEn: 'WeChat ID',             type: 'text',  required: false, enabled: false, locked: false },
  { key: 'department',  label: '部门',              labelEn: 'Department',            type: 'text',  required: false, enabled: false, locked: false },
  { key: 'job_title',   label: '职位',              labelEn: 'Job Title',             type: 'text',  required: false, enabled: false, locked: false },
  { key: 'employee_id', label: '工号',              labelEn: 'Employee ID',           type: 'text',  required: false, enabled: false, locked: false },
  { key: 'interest',    label: '感兴趣的产品/方案', labelEn: 'Products of Interest',  type: 'text',  required: false, enabled: false, locked: false },
  { key: 'scenario',    label: '应用场景',          labelEn: 'Application Scenario',  type: 'text',  required: false, enabled: false, locked: false },
  { key: 'need_contact',label: '是否需要专人联系',  labelEn: 'Request a Consultation',type: 'text',  required: false, enabled: false, locked: false },
  { key: 'remark',      label: '备注',              labelEn: 'Remarks',               type: 'text',  required: false, enabled: false, locked: false },
];

// 双语翻译表
const I18N = {
  zh: {
    optional: '（选填）',
    errDuplicate: '该手机号已参与过本次活动',
    errFail: '抽奖失败，请重试',
    spinning: '...',
    spinStart: '开始',
    congratsTitle: '恭喜获奖',
    congratsSub: '请凭此凭证前往展台服务处兑换奖品',
    certLabel: '获奖证明',
    winnerName: '获奖者',
    winnerPhone: '手机尾号',
    scanRedeem: '扫码核销',
    scanHint: '请出示此码至展台服务处兑换',
  },
  en: {
    optional: ' (Optional)',
    errDuplicate: 'This phone number has already participated.',
    errFail: 'Draw failed, please try again.',
    spinning: '...',
    spinStart: 'SPIN',
    congratsTitle: 'Congratulations!',
    congratsSub: 'Please show this voucher at the booth to claim your prize.',
    certLabel: 'Prize Certificate',
    winnerName: 'Winner',
    winnerPhone: 'Phone (last 4)',
    scanRedeem: 'Scan to Redeem',
    scanHint: 'Present this QR code at the exhibition booth.',
  },
} as const;
type Lang = 'zh' | 'en';

// ==========================================
// 主入口
// ==========================================
export default function TurntableLotteryPage() {
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('event') || '';
  const isAdmin = searchParams.get('mode') === 'admin';

  const [prizes, setPrizes] = useState<LuckPrize[]>([]);
  const [winners, setWinners] = useState<LuckWinner[]>([]);
  const [loading, setLoading] = useState(true);
  const [wheelTitle, setWheelTitle] = useState('展会幸运抽奖');
  const [wheelSubtitle, setWheelSubtitle] = useState('点击中心开始抽奖');
  const [formTitle, setFormTitle] = useState('光显展区抽奖');
  const [formSubtitle, setFormSubtitle] = useState('ISLE 2026 · LED Display Exhibition');
  const [formButtonText, setFormButtonText] = useState('登记并参与抽奖');
  const [footerText, setFooterText] = useState('ISLE 2026 LED光显科技展');
  // 英文版本
  const [wheelTitleEn, setWheelTitleEn] = useState('Lucky Draw');
  const [wheelSubtitleEn, setWheelSubtitleEn] = useState('Tap center to spin');
  const [formTitleEn, setFormTitleEn] = useState('Lucky Draw 2026');
  const [formSubtitleEn, setFormSubtitleEn] = useState('ISLE 2026 · LED Display Exhibition');
  const [formButtonTextEn, setFormButtonTextEn] = useState('Register & Draw');
  const [footerTextEn, setFooterTextEn] = useState('ISLE 2026 LED Display Technology');
  const [formFields, setFormFields] = useState<FormField[]>(DEFAULT_FORM_FIELDS);

  // 从 Supabase 加载奖品和中奖记录
  const refreshData = async () => {
    if (!eventId) { setLoading(false); return; }
    const [p, w, ev] = await Promise.all([
      getPrizes(eventId),
      isAdmin ? getWinnersWithPrizes(eventId) : Promise.resolve([]),
      getEvent(eventId),
    ]);
    setPrizes(p);
    setWinners(w);
    if (ev?.settings) {
      const s = ev.settings as Record<string, unknown>;
      if (s.wheelTitle) setWheelTitle(s.wheelTitle as string);
      if (s.wheelSubtitle) setWheelSubtitle(s.wheelSubtitle as string);
      if (s.formTitle) setFormTitle(s.formTitle as string);
      if (s.formSubtitle) setFormSubtitle(s.formSubtitle as string);
      if (s.formButtonText) setFormButtonText(s.formButtonText as string);
      if (s.footerText) setFooterText(s.footerText as string);
      if (s.wheelTitleEn) setWheelTitleEn(s.wheelTitleEn as string);
      if (s.wheelSubtitleEn) setWheelSubtitleEn(s.wheelSubtitleEn as string);
      if (s.formTitleEn) setFormTitleEn(s.formTitleEn as string);
      if (s.formSubtitleEn) setFormSubtitleEn(s.formSubtitleEn as string);
      if (s.formButtonTextEn) setFormButtonTextEn(s.formButtonTextEn as string);
      if (s.footerTextEn) setFooterTextEn(s.footerTextEn as string);
      if (Array.isArray(s.formFields)) {
        // Merge saved fields with defaults to handle new fields added later
        const saved = s.formFields as FormField[];
        setFormFields(DEFAULT_FORM_FIELDS.map(df => {
          const sf = saved.find(f => f.key === df.key);
          return sf ? { ...df, ...sf, locked: df.locked } : df;
        }));
      }
    }
    setLoading(false);
  };

  useEffect(() => { refreshData(); }, [eventId]);

  if (!eventId) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#FDFBF7] text-[#94a3b8]">
        <p>缺少活动 ID，请通过正确链接访问</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#FDFBF7]">
        <div className="animate-spin w-8 h-8 border-2 border-[#003cff] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div
      className="h-screen bg-[#FDFBF7] text-[#2c3e50] overflow-hidden relative"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
    >
      {/* 欧式古典暗纹背景 */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.04]"
        style={{ backgroundImage: 'radial-gradient(#003cff 1px, transparent 1px)', backgroundSize: '24px 24px' }}
      />
      {/* 极柔和弥散光 */}
      <div className="fixed top-[-10%] left-[-10%] w-[60vw] h-[60vw] rounded-full blur-[120px] pointer-events-none opacity-[0.08] bg-gradient-to-br from-[#003cff] to-transparent" />

      {isAdmin ? (
        <AdminApp
          eventId={eventId}
          prizes={prizes}
          setPrizes={setPrizes}
          winners={winners}
          setWinners={setWinners}
          onRefresh={refreshData}
          wheelTitle={wheelTitle}
          wheelSubtitle={wheelSubtitle}
          setWheelTitle={setWheelTitle}
          setWheelSubtitle={setWheelSubtitle}
          wheelTitleEn={wheelTitleEn} setWheelTitleEn={setWheelTitleEn}
          wheelSubtitleEn={wheelSubtitleEn} setWheelSubtitleEn={setWheelSubtitleEn}
          formTitle={formTitle} setFormTitle={setFormTitle}
          formSubtitle={formSubtitle} setFormSubtitle={setFormSubtitle}
          formButtonText={formButtonText} setFormButtonText={setFormButtonText}
          footerText={footerText} setFooterText={setFooterText}
          formTitleEn={formTitleEn} setFormTitleEn={setFormTitleEn}
          formSubtitleEn={formSubtitleEn} setFormSubtitleEn={setFormSubtitleEn}
          formButtonTextEn={formButtonTextEn} setFormButtonTextEn={setFormButtonTextEn}
          footerTextEn={footerTextEn} setFooterTextEn={setFooterTextEn}
          formFields={formFields} setFormFields={setFormFields}
        />
      ) : (
        <UserApp
          eventId={eventId}
          prizes={prizes}
          setPrizes={setPrizes}
          wheelTitle={wheelTitle}
          wheelSubtitle={wheelSubtitle}
          wheelTitleEn={wheelTitleEn}
          wheelSubtitleEn={wheelSubtitleEn}
          formTitle={formTitle}
          formSubtitle={formSubtitle}
          formButtonText={formButtonText}
          footerText={footerText}
          formTitleEn={formTitleEn}
          formSubtitleEn={formSubtitleEn}
          formButtonTextEn={formButtonTextEn}
          footerTextEn={footerTextEn}
          formFields={formFields}
        />
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&display=swap');
        .retro-shadow { box-shadow: 0 15px 40px -5px rgba(0,60,255,0.08), 0 0 0 1px rgba(0,60,255,0.05); }
        .retro-card-shadow { box-shadow: 0 20px 50px -10px rgba(0,30,80,0.15); }
        @keyframes fade-in-up {
          0%   { opacity: 0; transform: translateY(20px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-fade-in-up { animation: fade-in-up 0.8s cubic-bezier(0.16,1,0.3,1) forwards; }
        @keyframes retro-fade {
          0%   { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-retro-fade { animation: retro-fade 0.4s ease-out forwards; }
      ` }} />
    </div>
  );
}

// ==========================================
// C端：欧式复古卡罗牌交互前端
// ==========================================
function UserApp({
  eventId, prizes, setPrizes, wheelTitle, wheelSubtitle,
  wheelTitleEn, wheelSubtitleEn,
  formTitle, formSubtitle, formButtonText, footerText,
  formTitleEn, formSubtitleEn, formButtonTextEn, footerTextEn,
  formFields
}: {
  eventId: string;
  prizes: LuckPrize[];
  setPrizes: React.Dispatch<React.SetStateAction<LuckPrize[]>>;
  wheelTitle: string;
  wheelSubtitle: string;
  wheelTitleEn: string;
  wheelSubtitleEn: string;
  formTitle: string;
  formSubtitle: string;
  formButtonText: string;
  footerText: string;
  formTitleEn: string;
  formSubtitleEn: string;
  formButtonTextEn: string;
  footerTextEn: string;
  formFields: FormField[];
}) {
  const [step, setStep] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [winnerRecord, setWinnerRecord] = useState<LuckWinner | null>(null);
  const [rotation, setRotation] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [lang, setLang] = useState<Lang>(() => {
    try { return (localStorage.getItem('luck_lang') as Lang) || 'zh'; } catch { return 'zh'; }
  });
  const t = I18N[lang];

  // 根据语言选择显示内容
  const displayWheelTitle  = lang === 'en' ? (wheelTitleEn  || wheelTitle)       : wheelTitle;
  const displayWheelSubt   = lang === 'en' ? (wheelSubtitleEn || wheelSubtitle)   : wheelSubtitle;
  const displayTitle   = lang === 'en' ? (formTitleEn  || formTitle)       : formTitle;
  const displaySubt    = lang === 'en' ? (formSubtitleEn || formSubtitle)   : formSubtitle;
  const displayBtn     = lang === 'en' ? (formButtonTextEn || formButtonText): formButtonText;
  const displayFooter  = lang === 'en' ? (footerTextEn || footerText)       : footerText;

  // 页面加载时检查本地缓存：如果已经抽过奖，直接显示结果
  useEffect(() => {
    try {
      const cached = localStorage.getItem(`luck_winner_${eventId}`);
      if (cached) {
        const parsed = JSON.parse(cached) as LuckWinner;
        if (parsed && parsed.id) {
          setWinnerRecord(parsed);
          setStep(2);
        }
      }
    } catch { /* ignore */ }
  }, [eventId]);

  const availablePrizes = useMemo(() => prizes.filter(p => p.remaining > 0), [prizes]);

  // 检查必填字段是否都已填写
  const isFormValid = useMemo(() => {
    return formFields
      .filter(f => f.enabled && f.required)
      .every(f => (formData[f.key] || '').trim().length > 0);
  }, [formData, formFields]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;
    setErrorMsg('');

    // 检查手机号是否已抽过
    const dup = await checkPhoneDuplicate(eventId, formData.phone);
    if (dup) {
      setErrorMsg(t.errDuplicate);
      return;
    }

    setStep(1);
  };

  const handleDraw = () => {
    if (isDrawing || availablePrizes.length === 0) return;
    setIsDrawing(true);

    // 加权随机选奖
    const pool = availablePrizes;
    const total = pool.reduce((s, p) => s + p.remaining, 0);
    let r = Math.random() * total;
    let selectedPrize = pool[pool.length - 1];
    for (const p of pool) {
      r -= p.remaining;
      if (r <= 0) { selectedPrize = p; break; }
    }

    const targetIndex = availablePrizes.findIndex(p => p.id === selectedPrize.id);
    const sliceAngle = 360 / availablePrizes.length;
    const newRotation = rotation + (360 * 8) - (rotation % 360) - (targetIndex * sliceAngle);
    setRotation(newRotation);

    setTimeout(async () => {
      // 原子操作：扣减库存 + 写入中奖记录
      const result = await wheelDraw(eventId, selectedPrize.id, formData);

      if (result.success && result.winner) {
        // 刷新本地奖品库存
        setPrizes(prev => prev.map(p =>
          p.id === selectedPrize.id ? { ...p, remaining: Math.max(0, p.remaining - 1) } : p
        ));
        setWinnerRecord(result.winner);
        // 缓存到本地，下次访问直接显示结果
        try { localStorage.setItem(`luck_winner_${eventId}`, JSON.stringify(result.winner)); } catch { /* ignore */ }
        setStep(2);
      } else {
        setErrorMsg(result.error || t.errFail);
      }
      setIsDrawing(false);
    }, SPIN_DURATION);
  };



  return (
    <div className="flex flex-col h-screen px-4 relative z-10">

      {/* CN/EN 语言切换 */}
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={() => {
            const next: Lang = lang === 'zh' ? 'en' : 'zh';
            setLang(next);
            try { localStorage.setItem('luck_lang', next); } catch { /* ignore */ }
          }}
          className="flex items-center gap-0 bg-white/80 backdrop-blur-sm border border-[#003cff]/20 rounded-full overflow-hidden text-[11px] font-bold tracking-wider shadow-sm"
        >
          <span className={`px-3 py-1.5 transition-all ${ lang === 'zh' ? 'bg-[#003cff] text-white' : 'text-[#94a3b8] hover:text-[#003cff]' }`}>CN</span>
          <span className={`px-3 py-1.5 transition-all ${ lang === 'en' ? 'bg-[#003cff] text-white' : 'text-[#94a3b8] hover:text-[#003cff]' }`}>EN</span>
        </button>
      </div>

      {/* 可滚动的主内容区 */}
      <div className="flex-1 overflow-y-auto flex flex-col items-center pt-14 pb-4">
      <div className="w-full max-w-md my-auto flex-shrink-0">

        {/* ── STEP 0: 欧式优雅信息表单 ── */}
        <div className={`transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)]
          ${step === 0 ? 'opacity-100 translate-y-0 relative z-10' : 'opacity-0 -translate-y-10 absolute pointer-events-none'}`}>

          <div className="text-center space-y-3 mb-8">
            <h1 className="text-3xl sm:text-4xl font-black tracking-wider text-[#1a2332]" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
              {displayTitle}
            </h1>
            <div className="flex items-center justify-center gap-2 opacity-60">
              <span className="w-6 h-[1px] bg-[#003cff]" />
              <p className="text-[#003cff] text-[10px] tracking-[0.15em] uppercase whitespace-nowrap" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>{displaySubt}</p>
              <span className="w-6 h-[1px] bg-[#003cff]" />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 bg-white/60 backdrop-blur-xl p-8 rounded-2xl border border-[#003cff]/10 retro-shadow">
            {formFields.filter(f => f.enabled).map((field) => {
              const displayLabel = lang === 'en' ? (field.labelEn || field.label) : field.label;
              const placeholder = field.required
                ? `${displayLabel} *`
                : `${displayLabel}${t.optional}`;
              return (
                <div key={field.key} className="relative">
                  <input
                    type={field.type}
                    placeholder={placeholder}
                    value={formData[field.key] || ''}
                    onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                    required={field.required}
                    className="w-full bg-transparent border-b border-[#003cff]/20 px-4 py-4 outline-none focus:border-[#003cff] transition-all placeholder-[#94a3b8] text-[#1e293b] text-center text-lg"
                    style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
                  />
                </div>
              );
            })}
            <button
              type="submit"
              disabled={!isFormValid}
              className={`w-full relative overflow-hidden tracking-[0.2em] py-4 rounded mt-8 transition-all ${
                isFormValid
                  ? 'bg-[#003cff] text-white hover:bg-[#0028aa] active:scale-[0.98]'
                  : 'bg-[#cbd5e1] text-white/70 cursor-not-allowed'
              }`}
              style={{ fontFamily: '"Playfair Display", Georgia, serif', boxShadow: isFormValid ? '0 10px 20px rgba(0,60,255,0.2)' : 'none' }}
            >
              {displayBtn}
            </button>
            {errorMsg && (
              <p className="text-center text-red-500 text-xs mt-2">{errorMsg}</p>
            )}
          </form>
        </div>

        {/* ── STEP 1: 卡罗牌式优雅大转盘 ── */}
        <div className={`transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)]
          ${step === 1 ? 'opacity-100 translate-y-0 relative z-10' : 'opacity-0 translate-y-10 absolute pointer-events-none'}`}>

          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold tracking-widest text-[#1a2332]" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>{displayWheelTitle}</h2>
            <p className="text-[#003cff]/70 text-xs mt-3 tracking-[0.2em]" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>{displayWheelSubt}</p>
          </div>

          <div className="flex justify-center relative my-6 sm:my-8">

            {/* 古典精致指针 */}
            <div
              className="absolute -top-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center"
              style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.15))' }}
            >
              <div className="w-3 h-3 rounded-full border-[3px] border-[#003cff] bg-white z-10 relative top-2" />
              <div className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[35px] border-t-[#003cff]" />
            </div>

            {/* 转盘容器 */}
            <div
              className="relative w-[320px] h-[320px] rounded-full bg-[#fdfdfc] border-[8px] border-white flex items-center justify-center overflow-hidden ring-1 ring-[#003cff]/10"
              style={{ boxShadow: '0 15px 40px rgba(0,30,100,0.15)' }}
            >
              {/* 静态复古纹理底盘 */}
              <div className="absolute inset-0 rounded-full border border-[#003cff]/20 pointer-events-none m-2" />
              <div className="absolute inset-0 rounded-full border border-dashed border-[#003cff]/30 pointer-events-none m-4" />

              {/* 旋转层 */}
              <div
                className="w-full h-full rounded-full absolute inset-0"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transitionDuration: isDrawing ? `${SPIN_DURATION}ms` : '0s',
                  transitionTimingFunction: 'cubic-bezier(0.25, 1, 0.4, 1)',
                  transitionProperty: 'transform',
                }}
              >
                <svg width="100%" height="100%" viewBox="0 0 320 320">
                  {availablePrizes.map((p, i) => {
                    const sliceAngle = 360 / availablePrizes.length;
                    const startAngle = i * sliceAngle - 90 - sliceAngle / 2;
                    const endAngle   = startAngle + sliceAngle;
                    const pathData   = createSlice(160, 160, 160, startAngle, endAngle);
                    const textArcData = createTextArc(160, 160, 132, startAngle, endAngle);
                    const fill = i % 2 === 0 ? '#ffffff' : '#f5f8ff';
                    const PIcon = IconMap[p.description || ''] || Gift;
                    const rotDeg = i * sliceAngle;

                    return (
                      <g key={p.id}>
                        <path d={pathData} fill={fill} stroke="#003cff" strokeWidth="0.5" strokeOpacity="0.2" />
                        <path id={`text-arc-u-${i}`} d={textArcData} fill="none" />
                        <text fill="#003cff" fontSize="13" fontWeight="bold" letterSpacing="2" fontFamily="Georgia, serif">
                          <textPath href={`#text-arc-u-${i}`} startOffset="50%" textAnchor="middle">
                            {lang === 'en' ? (p.name_en || p.name) : p.name}
                          </textPath>
                        </text>
                        <g transform={`translate(160,160) rotate(${rotDeg})`}>
                          <foreignObject x={-12} y={-100} width="24" height="24" style={{ overflow: 'visible' }}>
                            <div style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <PIcon size={18} color="#003cff" strokeWidth={1.8} />
                            </div>
                          </foreignObject>
                          <circle cx="0" cy="-120" r="2" fill="#003cff" opacity="0.3" />
                        </g>
                      </g>
                    );
                  })}
                  {availablePrizes.length === 0 && (
                    <circle cx="160" cy="160" r="160" fill="#f5f8ff" />
                  )}
                </svg>
              </div>

              {/* 中心控制核心 */}
              <button
                onClick={handleDraw}
                disabled={isDrawing || availablePrizes.length === 0}
                className="absolute w-20 h-20 bg-white rounded-full z-20 flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:scale-100 disabled:opacity-90 border-[4px] border-[#f0f4ff]"
                style={{ boxShadow: '0 10px 20px rgba(0,30,100,0.15)' }}
              >
                <div
                  className="w-14 h-14 rounded-full bg-[#003cff] flex flex-col items-center justify-center relative overflow-hidden"
                  style={{ boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.4)' }}
                >
                  <div className="absolute top-0 left-0 w-full h-1/2 bg-white/20 rounded-t-full pointer-events-none" />
                  <Sparkles className="w-5 h-5 text-white mb-0.5" strokeWidth={1.5} />
                  <span className="text-white text-[9px] tracking-[0.2em] uppercase mt-1" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
                    {isDrawing ? t.spinning : t.spinStart}
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* ── STEP 2: 欧式典藏凭证 ── */}
        <div className={`w-full transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)]
          ${step === 2 ? 'opacity-100 translate-y-0 relative z-10' : 'opacity-0 translate-y-10 absolute pointer-events-none'}`}>
          {step === 2 && winnerRecord?.prize && (
            <div className="space-y-6 animate-fade-in-up">
              <div className="text-center space-y-3 mb-8">
                <div
                  className="w-14 h-14 border border-[#00cb35] rounded-full flex items-center justify-center mx-auto mb-4 bg-white"
                  style={{ boxShadow: '0 2px 10px rgba(0,203,53,0.15)' }}
                >
                  <CheckCircle2 className="w-8 h-8 text-[#00cb35]" strokeWidth={1.5} />
                </div>
                <h2 className="text-3xl font-black tracking-widest text-[#1a2332]" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>{t.congratsTitle}</h2>
                <p className="text-[#003cff]/70 text-sm italic tracking-wide" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>{t.congratsSub}</p>
              </div>

              {/* 典藏白卡凭证 */}
              <div className="bg-white rounded-md p-1.5 relative overflow-hidden retro-card-shadow">
                <div className="bg-[#fdfbf7] border border-[#003cff]/20 h-full relative p-6">
                  {/* 四角复古装饰花纹 */}
                  <div className="absolute top-2 left-2 text-[#003cff]/30 text-lg leading-none" style={{ fontFamily: 'serif' }}>+</div>
                  <div className="absolute top-2 right-2 text-[#003cff]/30 text-lg leading-none" style={{ fontFamily: 'serif' }}>+</div>
                  <div className="absolute bottom-2 left-2 text-[#003cff]/30 text-lg leading-none" style={{ fontFamily: 'serif' }}>+</div>
                  <div className="absolute bottom-2 right-2 text-[#003cff]/30 text-lg leading-none" style={{ fontFamily: 'serif' }}>+</div>

                  <div className="flex flex-col items-center border-b border-[#003cff]/10 pb-6 mb-6 mt-2">
                    <p className="text-[#94a3b8] text-[10px] uppercase tracking-[0.3em] mb-3" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>ISLE 2026 · {t.certLabel}</p>
                    <h3 className="text-2xl font-bold text-center text-[#003cff] tracking-wide" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
                      {lang === 'en' ? (winnerRecord.prize.name_en || winnerRecord.prize.name) : winnerRecord.prize.name}
                    </h3>
                    {winnerRecord.prize.description && (
                      <p className="text-[#94a3b8] text-xs mt-2 italic" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>{winnerRecord.prize.description}</p>
                    )}
                  </div>

                  <div className="space-y-4 px-2 text-sm text-[#475569]" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
                    <div className="flex justify-between items-end border-b border-dashed border-[#e2e8f0] pb-2">
                      <span className="text-[#94a3b8] text-xs italic">{t.winnerName}</span>
                      <span className="font-bold text-[#1e293b] text-base">{winnerRecord.name}</span>
                    </div>
                    <div className="flex justify-between items-end border-b border-dashed border-[#e2e8f0] pb-2">
                      <span className="text-[#94a3b8] text-xs italic">{t.winnerPhone}</span>
                      <span className="font-bold text-[#003cff] text-base">{(winnerRecord.phone || '').slice(-4)}</span>
                    </div>
                  </div>

                  {/* 真实可扫描二维码区域 */}
                  <div className="mt-8 flex flex-col items-center">
                    <p className="text-[#94a3b8] text-[9px] uppercase tracking-[0.25em] mb-3" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>{t.scanRedeem}</p>
                    <div
                      className="bg-white p-3 border border-[#003cff]/15"
                      style={{ boxShadow: '0 2px 12px rgba(0,60,255,0.08)' }}
                    >
                      <QRCodeSVG
                        value={winnerRecord.redeem_code || winnerRecord.id}
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
                        {winnerRecord.redeem_code || winnerRecord.id}
                      </p>
                    </div>
                    <p className="text-center text-[#c0c8d8] text-[9px] mt-3 tracking-[0.2em] uppercase">{t.scanHint}</p>
                  </div>
                </div>
              </div>

              {/* 每人仅限一次提示，不提供重置入口 */}
              {/* <div className="flex items-center justify-center gap-2 py-4 opacity-50">
                <span className="w-6 h-[1px] bg-[#003cff]" />
                <p className="text-[#003cff] text-[10px] tracking-[0.25em] uppercase" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
                  每位访客仅限参与一次
                </p>
                <span className="w-6 h-[1px] bg-[#003cff]" />
              </div> */}
            </div>
          )}
        </div>
      </div>

      {/* 页脚品牌落款 - 随内容滚动 */}
      <div className="shrink-0 w-full mt-6 py-4 flex flex-col items-center gap-1.5" style={{ opacity: 0.5 }}>
        <img src="/logo_24.svg" alt="Unilumin" className="h-6" />
        <p
          className="text-[#003cff] text-[9px] tracking-[0.2em] uppercase whitespace-nowrap"
          style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
        >
          {displayFooter}
        </p>
      </div>
      </div>
    </div>
  );
}

// ==========================================
// B端：展会总控后台
// ==========================================
function AdminApp({
  eventId, prizes, setPrizes, winners, setWinners, onRefresh: _onRefresh,
  wheelTitle, wheelSubtitle, setWheelTitle, setWheelSubtitle,
  wheelTitleEn, setWheelTitleEn, wheelSubtitleEn, setWheelSubtitleEn,
  formTitle, setFormTitle, formSubtitle, setFormSubtitle,
  formButtonText, setFormButtonText, footerText, setFooterText,
  formTitleEn, setFormTitleEn, formSubtitleEn, setFormSubtitleEn,
  formButtonTextEn, setFormButtonTextEn, footerTextEn, setFooterTextEn,
  formFields, setFormFields
}: {
  eventId: string;
  prizes: LuckPrize[];
  setPrizes: React.Dispatch<React.SetStateAction<LuckPrize[]>>;
  winners: LuckWinner[];
  setWinners: React.Dispatch<React.SetStateAction<LuckWinner[]>>;
  onRefresh: () => void;
  wheelTitle: string;
  wheelSubtitle: string;
  setWheelTitle: React.Dispatch<React.SetStateAction<string>>;
  setWheelSubtitle: React.Dispatch<React.SetStateAction<string>>;
  wheelTitleEn: string; setWheelTitleEn: React.Dispatch<React.SetStateAction<string>>;
  wheelSubtitleEn: string; setWheelSubtitleEn: React.Dispatch<React.SetStateAction<string>>;
  formTitle: string; setFormTitle: React.Dispatch<React.SetStateAction<string>>;
  formSubtitle: string; setFormSubtitle: React.Dispatch<React.SetStateAction<string>>;
  formButtonText: string; setFormButtonText: React.Dispatch<React.SetStateAction<string>>;
  footerText: string; setFooterText: React.Dispatch<React.SetStateAction<string>>;
  formTitleEn: string; setFormTitleEn: React.Dispatch<React.SetStateAction<string>>;
  formSubtitleEn: string; setFormSubtitleEn: React.Dispatch<React.SetStateAction<string>>;
  formButtonTextEn: string; setFormButtonTextEn: React.Dispatch<React.SetStateAction<string>>;
  footerTextEn: string; setFooterTextEn: React.Dispatch<React.SetStateAction<string>>;
  formFields: FormField[]; setFormFields: React.Dispatch<React.SetStateAction<FormField[]>>;
}) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'prizes' | 'pageConfig'>('dashboard');
  const [searchText, setSearchText] = useState('');
  const [editingPrize, setEditingPrize] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; name_en: string; description: string; quantity: number }>({ name: '', name_en: '', description: '', quantity: 1 });
  const [addingPrize, setAddingPrize] = useState(false);
  const [newPrize, setNewPrize] = useState({ name: '', name_en: '', description: 'Gift', quantity: 5 });
  const [redeemCodeInput, setRedeemCodeInput] = useState('');
  const [redeemMsg, setRedeemMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [lookupWinner, setLookupWinner] = useState<LuckWinner | null>(null);
  const [lookupError, setLookupError] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const stats = {
    totalWinners: winners.length,
    redeemedCount: winners.filter(w => w.status === 'redeemed').length,
    remainingPrizes: prizes.reduce((acc, p) => acc + p.remaining, 0),
  };

  const handleRedeem = async (winnerId: string) => {
    const ok = await redeemWinner(winnerId);
    if (ok) {
      setWinners(prev => prev.map(w => w.id === winnerId ? { ...w, status: 'redeemed' as const, redeemed_at: new Date().toISOString() } : w));
    }
  };

  const handleRedeemByCode = async () => {
    if (!redeemCodeInput.trim()) return;
    setRedeemMsg(null);
    // First lookup to show confirmation modal
    const lookup = await lookupByCode(eventId, redeemCodeInput);
    if (lookup.found && lookup.winner) {
      setLookupWinner(lookup.winner);
      setLookupError('');
    } else {
      setRedeemMsg({ type: 'error', text: lookup.error || '未找到匹配的兑换码' });
    }
  };

  // 确认核销（弹窗中点击确认）
  const confirmRedeem = async () => {
    if (!lookupWinner) return;
    const ok = await redeemWinner(lookupWinner.id);
    if (ok) {
      setWinners(prev => prev.map(w => w.id === lookupWinner.id ? { ...w, status: 'redeemed' as const, redeemed_at: new Date().toISOString() } : w));
      setLookupWinner({ ...lookupWinner, status: 'redeemed', redeemed_at: new Date().toISOString() });
      setRedeemCodeInput('');
    }
  };

  // 启动扫码
  const startScanning = useCallback(async () => {
    setScanning(true);
    setRedeemMsg(null);
    // Wait for DOM to render the container
    await new Promise(r => setTimeout(r, 300));
    try {
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          // Found a QR code
          await scanner.stop();
          scannerRef.current = null;
          setScanning(false);
          setRedeemCodeInput(decodedText);
          // Auto lookup
          const lookup = await lookupByCode(eventId, decodedText);
          if (lookup.found && lookup.winner) {
            setLookupWinner(lookup.winner);
            setLookupError('');
          } else {
            setLookupError(lookup.error || '未找到匹配的兑换码');
            setLookupWinner(null);
          }
        },
        () => {} // ignore scan failures
      );
    } catch (err) {
      console.error('启动扫码失败:', err);
      setScanning(false);
      setRedeemMsg({ type: 'error', text: '无法启动摄像头，请检查权限或使用手动输入' });
    }
  }, [eventId]);

  // 停止扫码
  const stopScanning = useCallback(async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
  }, []);

  // 开始编辑奖项
  const startEdit = (prize: LuckPrize) => {
    setEditingPrize(prize.id);
    setEditForm({ name: prize.name, name_en: prize.name_en || '', description: prize.description || '', quantity: prize.quantity });
  };

  // 保存编辑
  const saveEdit = async (prizeId: string) => {
    const drawn = (() => {
      const p = prizes.find(x => x.id === prizeId);
      return p ? p.quantity - p.remaining : 0;
    })();
    const newRemaining = Math.max(0, editForm.quantity - drawn);
    await updatePrize(prizeId, {
      name: editForm.name,
      name_en: editForm.name_en || null,
      description: editForm.description,
      quantity: editForm.quantity,
      remaining: newRemaining,
    });
    setPrizes(prev => prev.map(p =>
      p.id === prizeId ? { ...p, name: editForm.name, name_en: editForm.name_en || null, description: editForm.description, quantity: editForm.quantity, remaining: newRemaining } : p
    ));
    setEditingPrize(null);
  };

  // 添加新奖项
  const handleAddPrize = async () => {
    if (!newPrize.name.trim()) return;
    const prize = await createPrize(eventId, {
      name: newPrize.name.trim(),
      name_en: newPrize.name_en.trim() || null,
      description: newPrize.description || 'Gift',
      quantity: newPrize.quantity,
      sort_order: prizes.length + 1,
    });
    if (prize) {
      setPrizes(prev => [...prev, prize]);
      setNewPrize({ name: '', name_en: '', description: 'Gift', quantity: 5 });
      setAddingPrize(false);
    }
  };

  // 删除奖项
  const handleDeletePrize = async (prizeId: string) => {
    const prize = prizes.find(p => p.id === prizeId);
    if (prize && prize.quantity !== prize.remaining) {
      if (!confirm(`该奖项已有 ${prize.quantity - prize.remaining} 人中奖，确定删除吗？`)) return;
    }
    const ok = await deletePrize(prizeId);
    if (ok) {
      setPrizes(prev => prev.filter(p => p.id !== prizeId));
    }
  };

  const filteredWinners = winners.filter(w =>
    w.name.includes(searchText) || (w.phone || '').includes(searchText) || (w.company || '').includes(searchText) || (w.redeem_code || '').toUpperCase().includes(searchText.toUpperCase())
  );




  const navItems = [
    { id: 'dashboard' as const, icon: LayoutDashboard, label: '系统概览' },
    { id: 'users'     as const, icon: Users,           label: '终端用户' },
    { id: 'prizes'    as const, icon: Settings,         label: '奖项配置' },
    { id: 'pageConfig' as const, icon: FileText,       label: '页面配置' },
  ];

  return (
    <div className="h-screen flex flex-col bg-[#f8fafc] text-[#1e293b] overflow-hidden">

      {/* ── 顶部 Header ── */}
      <div className="shrink-0 flex items-center justify-between px-5 py-3 bg-white border-b border-[#e2e8f0]">
        <div className="flex items-center gap-3">
          <a
            href={`/project/${eventId}`}
            className="p-2 hover:bg-[#f1f5f9] rounded-lg transition-colors text-[#64748b] hover:text-[#0f172a]"
            title="返回项目"
          >
            <ArrowLeft size={18} />
          </a>
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-[#003cff]" />
            <span className="font-black tracking-widest text-[#003cff] text-sm uppercase" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
              Admin Console
            </span>
          </div>
        </div>
        <a
          href={`/lottery/wheel?event=${eventId}`}
          className="flex items-center gap-1.5 text-xs font-bold text-[#64748b] hover:text-[#003cff] transition-colors px-3 py-1.5 rounded-lg hover:bg-[#f0f4ff]"
        >
          <Ticket size={14} />
          预览用户端
        </a>
      </div>

      {/* ── 主体 ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* 桌面端侧边栏 */}
        <div className="hidden md:flex w-52 shrink-0 border-r border-[#e2e8f0] bg-white flex-col p-4 gap-2">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-bold border
                ${activeTab === item.id
                  ? 'bg-[#003cff]/5 text-[#003cff] border-[#003cff]/20'
                  : 'border-transparent text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9]'
                }`}
            >
              <item.icon size={16} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-20 md:pb-8">
          <div className="max-w-4xl mx-auto space-y-5">

            {/* ── 数据看板 ── */}
            {activeTab === 'dashboard' && (
              <div className="space-y-5 animate-retro-fade">
                <h2 className="text-xl font-black tracking-widest text-[#0f172a]" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>系统概览</h2>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: '总参与人数',   value: stats.totalWinners,    color: 'text-[#0f172a]', bg: 'bg-white' },
                    { label: '已核销发放',   value: stats.redeemedCount,   color: 'text-[#003cff]', bg: 'bg-[#f0f4ff]' },
                    { label: '剩余奖品库存', value: stats.remainingPrizes, color: 'text-[#0f172a]', bg: 'bg-white' },
                  ].map((stat, idx) => (
                    <div key={idx} className={`p-4 rounded-2xl border border-[#e2e8f0] shadow-sm ${stat.bg}`}>
                      <p className="text-[#64748b] text-[10px] font-bold tracking-wide leading-tight mb-2">{stat.label}</p>
                      <p className={`text-3xl font-black ${stat.color}`}>{stat.value}</p>
                    </div>
                  ))}
                </div>


                {/* 奖项库存一览 */}
                <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-[#e2e8f0]">
                    <h3 className="font-black text-[#0f172a] tracking-widest text-xs uppercase" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>奖项库存一览</h3>
                  </div>
                  <div className="divide-y divide-[#f1f5f9]">
                    {prizes.map(p => {
                      const pct = p.quantity > 0 ? Math.round((p.remaining / p.quantity) * 100) : 0;
                      const Icon = IconMap[p.description || ''] || Gift;
                      return (
                        <div key={p.id} className="px-5 py-3 flex items-center gap-3">
                          <div className="w-8 h-8 bg-[#f0f4ff] rounded-xl flex items-center justify-center shrink-0">
                            <Icon className="text-[#003cff] w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between mb-1">
                              <span className="font-bold text-[#0f172a] text-sm truncate">{p.name}</span>
                              <span className="text-xs text-[#64748b] ml-2 shrink-0">{p.remaining}/{p.quantity}</span>
                            </div>
                            <div className="h-1.5 bg-[#f1f5f9] rounded-full overflow-hidden">
                              <div className="h-full bg-[#003cff] rounded-full transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── 用户核销 ── */}
            {activeTab === 'users' && (
              <div className="space-y-4 animate-retro-fade">
                <div className="flex justify-between items-center gap-3 flex-wrap">
                  <h2 className="text-xl font-black tracking-widest text-[#0f172a]" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>用户数据</h2>
                  <div className="bg-white border border-[#cbd5e1] px-3 py-2 rounded-xl flex items-center gap-2 flex-1 min-w-0 max-w-xs focus-within:border-[#003cff] transition-colors shadow-sm">
                    <Search size={14} className="text-[#94a3b8] shrink-0" />
                    <input
                      type="text"
                      placeholder="搜索姓名、手机号或兑换码..."
                      value={searchText}
                      onChange={e => setSearchText(e.target.value)}
                      className="bg-transparent border-none outline-none text-sm w-full text-[#1e293b] placeholder-[#94a3b8]"
                    />
                  </div>
                </div>

                {/* 快速核销卡片 */}
                <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm p-4">
                  <h3 className="font-bold text-sm text-[#0f172a] mb-3">📱 奖品核销</h3>

                  {/* 输入兑换码 */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="输入兑换码，如 ISLE2026-12345678"
                      value={redeemCodeInput}
                      onChange={e => setRedeemCodeInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleRedeemByCode()}
                      className="flex-1 bg-[#f8fafc] border border-[#cbd5e1] px-3 py-2.5 rounded-xl text-sm outline-none focus:border-[#003cff] focus:ring-2 focus:ring-[#003cff]/10 text-[#0f172a] font-mono tracking-wider"
                    />
                    <button
                      onClick={handleRedeemByCode}
                      className="px-4 py-2.5 bg-[#003cff] text-white rounded-xl text-sm font-bold hover:bg-[#0030cc] transition-all active:scale-95 shrink-0"
                    >
                      查询
                    </button>
                    <button
                      onClick={scanning ? stopScanning : startScanning}
                      className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 shrink-0 flex items-center gap-1.5
                        ${scanning ? 'bg-[#ef4444] text-white hover:bg-[#dc2626]' : 'bg-[#f0f4ff] text-[#003cff] border border-[#003cff]/20 hover:bg-[#e8edff]'}`}
                    >
                      <Camera size={16} />
                      {scanning ? '关闭' : '扫码'}
                    </button>
                  </div>

                  {redeemMsg && (
                    <p className={`text-sm mt-2 font-bold ${redeemMsg.type === 'success' ? 'text-[#00cb35]' : 'text-[#ef4444]'}`}>
                      {redeemMsg.text}
                    </p>
                  )}
                  {lookupError && !lookupWinner && (
                    <p className="text-sm mt-2 font-bold text-[#ef4444]">{lookupError}</p>
                  )}

                  {/* 扫码摄像头区域 */}
                  {scanning && (
                    <div className="mt-3 rounded-xl overflow-hidden border border-[#e2e8f0] bg-black">
                      <div id="qr-reader" ref={scannerContainerRef} style={{ width: '100%' }} />
                      <p className="text-center text-white/60 text-xs py-2">将二维码对准摄像头框内</p>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {filteredWinners.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-[#e2e8f0] py-12 text-center text-[#94a3b8] text-sm">暂无数据记录</div>
                  ) : filteredWinners.map(winner => {
                    const PIcon = IconMap[winner.prize?.description || ''] || Gift;
                    return (
                    <div key={winner.id} className="bg-white border border-[#e2e8f0] rounded-2xl p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-[#0f172a]">{winner.name}</span>
                            <span className="text-xs text-[#64748b]">{winner.phone}</span>
                            {winner.company && <span className="text-xs text-[#94a3b8]">· {winner.company}</span>}
                          </div>
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-bold border-[#003cff]/20 text-[#003cff] bg-[#003cff]/5">
                              <PIcon size={12} />
                              {winner.prize?.name || '未知奖项'}
                            </span>
                            <span className="text-[10px] text-[#94a3b8]">
                              {new Date(winner.won_at).toLocaleString('zh-CN')}
                            </span>
                          </div>
                          {/* 兑换码 */}
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-[10px] text-[#94a3b8]">兑换码:</span>
                            <span className="text-xs font-bold text-[#003cff] font-mono tracking-wider select-all bg-[#f0f4ff] px-2 py-0.5 rounded">
                              {winner.redeem_code || '-'}
                            </span>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          {winner.status === 'redeemed' ? (
                            <div>
                              <span className="text-[#00cb35] text-xs font-bold flex items-center gap-1">
                                <CheckCircle2 size={14} /> 已核销
                              </span>
                              {winner.redeemed_at && (
                                <p className="text-[9px] text-[#94a3b8] mt-1">
                                  {new Date(winner.redeemed_at).toLocaleString('zh-CN')}
                                </p>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() => handleRedeem(winner.id)}
                              className="bg-[#003cff] text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-[#0030cc] transition-all shadow-sm"
                            >
                              核销
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── 奖项配置（完整CRUD + 实时预览） ── */}
            {activeTab === 'prizes' && (() => {
              const iconChoices: { key: string; label: string; icon: LucideIcon }[] = [
                { key: 'Gift',        label: '礼物', icon: Gift },
                { key: 'Smartphone',  label: '手机', icon: Smartphone },
                { key: 'Headphones',  label: '耳机', icon: Headphones },
                { key: 'ShoppingBag', label: '购物袋', icon: ShoppingBag },
                { key: 'Coffee',      label: '咖啡', icon: Coffee },
                { key: 'Hexagon',     label: '钻石', icon: Hexagon },
              ];

              const IconPicker = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
                <div className="grid grid-cols-3 gap-1.5">
                  {iconChoices.map(({ key, label, icon: Ico }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onChange(key)}
                      className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all text-[11px] font-bold
                        ${value === key
                          ? 'border-[#003cff] bg-[#f0f4ff] text-[#003cff]'
                          : 'border-[#e2e8f0] bg-white text-[#64748b] hover:border-[#94a3b8]'
                        }`}
                    >
                      <Ico size={18} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              );

              // 生成迷你转盘预览的扇区
              const previewPrizes = prizes.map(p =>
                p.id === editingPrize
                  ? { ...p, name: editForm.name, description: editForm.description, quantity: editForm.quantity, remaining: editForm.quantity - (p.quantity - p.remaining) }
                  : p
              ).filter(p => p.remaining > 0);

              return (
              <div className="space-y-5 animate-retro-fade">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-black tracking-widest text-[#0f172a]" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>奖项配置</h2>
                  <button
                    onClick={() => setAddingPrize(true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#003cff] text-white rounded-xl text-sm font-bold hover:bg-[#0030cc] transition-all active:scale-95"
                  >
                    <Plus size={16} />
                    新增奖项
                  </button>
                </div>

                {/* 转盘标题配置 */}
                <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm p-4">
                  <p className="text-[10px] text-[#94a3b8] mb-3">每项均支持中英双语，左侧中文 · 右侧英文</p>
                  <div className="space-y-2 mb-3">
                    <div>
                      <label className="text-[11px] text-[#64748b] font-bold block mb-1">转盘标题 / Wheel Title</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" value={wheelTitle} onChange={e => setWheelTitle(e.target.value)} placeholder="展会幸运抽奖"
                          className="w-full bg-[#f8fafc] border border-[#cbd5e1] px-2.5 py-1.5 rounded-lg text-sm outline-none focus:border-[#003cff] text-[#0f172a]" />
                        <input type="text" value={wheelTitleEn} onChange={e => setWheelTitleEn(e.target.value)} placeholder="Lucky Draw"
                          className="w-full bg-[#f8fafc] border border-[#e2e8f0] px-2.5 py-1.5 rounded-lg text-sm outline-none focus:border-[#003cff] text-[#64748b]" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] text-[#64748b] font-bold block mb-1">副标题 / Subtitle</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" value={wheelSubtitle} onChange={e => setWheelSubtitle(e.target.value)} placeholder="点击中心开始抽奖"
                          className="w-full bg-[#f8fafc] border border-[#cbd5e1] px-2.5 py-1.5 rounded-lg text-sm outline-none focus:border-[#003cff] text-[#0f172a]" />
                        <input type="text" value={wheelSubtitleEn} onChange={e => setWheelSubtitleEn(e.target.value)} placeholder="Tap center to spin"
                          className="w-full bg-[#f8fafc] border border-[#e2e8f0] px-2.5 py-1.5 rounded-lg text-sm outline-none focus:border-[#003cff] text-[#64748b]" />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={async () => {
                        const ok = await updateProject(eventId, {
                            settings: { wheelTitle, wheelSubtitle, wheelTitleEn, wheelSubtitleEn, formTitle, formSubtitle, formButtonText, footerText, formTitleEn, formSubtitleEn, formButtonTextEn, footerTextEn, formFields }
                        });
                        if (ok) showToast('✅ 已保存');
                      }}
                      className="px-4 py-1.5 bg-[#003cff] text-white text-xs font-bold rounded-lg hover:bg-[#0030cc] transition-all shrink-0"
                    >
                      保存
                    </button>
                  </div>
                </div>

                {/* 新增奖项表单 */}
                {addingPrize && (
                  <div className="bg-white border-2 border-[#003cff]/20 p-5 rounded-2xl shadow-sm space-y-4">
                    <h3 className="font-bold text-sm text-[#003cff]">新增奖项</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <label className="text-xs text-[#64748b] font-bold">奖项名称 <span className="font-normal text-[#94a3b8]">/ Prize Name</span></label>
                          <input
                            type="text"
                            value={newPrize.name}
                            onChange={e => setNewPrize(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="中文（如：一等奖）"
                            className="w-full bg-[#f8fafc] border border-[#cbd5e1] px-3 py-2 rounded-lg text-sm outline-none focus:border-[#003cff] focus:ring-2 focus:ring-[#003cff]/10 text-[#0f172a]"
                            autoFocus
                          />
                          <input
                            type="text"
                            value={newPrize.name_en}
                            onChange={e => setNewPrize(prev => ({ ...prev, name_en: e.target.value }))}
                            placeholder="English (e.g. First Prize)"
                            className="w-full bg-[#f8fafc] border border-[#e2e8f0] px-3 py-2 rounded-lg text-sm outline-none focus:border-[#003cff] text-[#64748b]"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-[#64748b] font-bold">数量</label>
                          <input
                            type="number"
                            value={newPrize.quantity}
                            onChange={e => setNewPrize(prev => ({ ...prev, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
                            min={1}
                            className="w-full bg-[#f8fafc] border border-[#cbd5e1] px-3 py-2 rounded-lg text-sm outline-none focus:border-[#003cff] focus:ring-2 focus:ring-[#003cff]/10 text-[#0f172a]"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-[#64748b] font-bold">选择图标</label>
                        <IconPicker value={newPrize.description} onChange={v => setNewPrize(prev => ({ ...prev, description: v }))} />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => { setAddingPrize(false); setNewPrize({ name: '', name_en: '', description: 'Gift', quantity: 5 }); }}
                        className="px-4 py-2 text-sm font-bold text-[#64748b] hover:bg-[#f1f5f9] rounded-lg transition-colors"
                      >
                        取消
                      </button>
                      <button
                        onClick={handleAddPrize}
                        disabled={!newPrize.name.trim()}
                        className="px-4 py-2 bg-[#003cff] text-white text-sm font-bold rounded-lg hover:bg-[#0030cc] disabled:opacity-50 transition-all"
                      >
                        确认添加
                      </button>
                    </div>
                  </div>
                )}

                {/* 两栏布局：左奖项列表 / 右实时预览 */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* 左：奖项列表 */}
                  <div className="lg:col-span-2 space-y-4">
                    {prizes.map(prize => {
                      const Icon = IconMap[prize.description || ''] || Gift;
                      const isEditing = editingPrize === prize.id;
                      const drawn = prize.quantity - prize.remaining;

                      return (
                        <div key={prize.id} className="bg-white border border-[#e2e8f0] p-5 rounded-2xl shadow-sm">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-[#f0f4ff] rounded-xl flex items-center justify-center shrink-0">
                                <Icon className="text-[#003cff] w-5 h-5" />
                              </div>
                              {isEditing ? (
                                <div className="flex-1 space-y-1.5">
                                  <input
                                    type="text"
                                    value={editForm.name}
                                    onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="中文名（如：一等奖）"
                                    className="bg-[#f8fafc] border border-[#cbd5e1] px-2 py-1 rounded-lg text-sm font-bold outline-none focus:border-[#003cff] text-[#0f172a] w-full"
                                  />
                                  <input
                                    type="text"
                                    value={editForm.name_en}
                                    onChange={e => setEditForm(prev => ({ ...prev, name_en: e.target.value }))}
                                    placeholder="English name (e.g. First Prize)"
                                    className="bg-[#f8fafc] border border-[#e2e8f0] px-2 py-1 rounded-lg text-xs outline-none focus:border-[#003cff] text-[#64748b] w-full"
                                  />
                                </div>
                              ) : (
                                <div>
                                  <h3 className="text-sm font-bold text-[#0f172a]">{prize.name}{prize.name_en && <span className="text-[#94a3b8] font-normal ml-1.5 text-xs">/ {prize.name_en}</span>}</h3>
                                  <p className="text-xs text-[#64748b] mt-0.5">{iconChoices.find(c => c.key === prize.description)?.label || prize.description || '礼物'}</p>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {isEditing ? (
                                <button
                                  onClick={() => saveEdit(prize.id)}
                                  className="p-1.5 hover:bg-[#f0f4ff] rounded-lg text-[#003cff] transition-colors"
                                  title="保存"
                                >
                                  <Save size={16} />
                                </button>
                              ) : (
                                <button
                                  onClick={() => startEdit(prize)}
                                  className="p-1.5 hover:bg-[#f1f5f9] rounded-lg text-[#64748b] transition-colors"
                                  title="编辑"
                                >
                                  <Edit3 size={16} />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeletePrize(prize.id)}
                                className="p-1.5 hover:bg-[#fff5f5] rounded-lg text-[#94a3b8] hover:text-[#ef4444] transition-colors"
                                title="删除"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>

                          {/* 编辑模式下的图标选择器 */}
                          {isEditing && (
                            <div className="mb-4">
                              <label className="text-xs text-[#64748b] font-bold mb-2 block">选择图标</label>
                              <IconPicker value={editForm.description} onChange={v => setEditForm(prev => ({ ...prev, description: v }))} />
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-xs text-[#64748b] font-bold">总库存 (件)</label>
                              {isEditing ? (
                                <input
                                  type="number"
                                  value={editForm.quantity}
                                  min={drawn}
                                  onChange={e => setEditForm(prev => ({ ...prev, quantity: Math.max(drawn, parseInt(e.target.value) || 0) }))}
                                  className="w-full bg-[#f8fafc] border border-[#cbd5e1] px-3 py-2 rounded-lg text-sm outline-none focus:border-[#003cff] focus:ring-2 focus:ring-[#003cff]/10 text-[#0f172a]"
                                />
                              ) : (
                                <div className="w-full bg-[#f8fafc] border border-[#e2e8f0] px-3 py-2 rounded-lg text-sm text-[#0f172a] font-medium">
                                  {prize.quantity}
                                </div>
                              )}
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs text-[#64748b] font-bold">已抽取</label>
                              <div className="w-full bg-[#f8fafc] border border-[#e2e8f0] px-3 py-2 rounded-lg text-sm text-[#64748b]">
                                {drawn} / {prize.quantity}
                              </div>
                            </div>
                          </div>

                          {drawn > 0 && (
                            <button
                              onClick={async () => {
                                await updatePrize(prize.id, { remaining: prize.quantity });
                                setPrizes(prev => prev.map(p => p.id === prize.id ? { ...p, remaining: p.quantity } : p));
                              }}
                              className="mt-3 text-xs text-[#ef4444] hover:underline"
                            >
                              重置已抽取
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {prizes.length === 0 && (
                      <div className="bg-white rounded-2xl border border-[#e2e8f0] py-12 text-center text-[#94a3b8] text-sm">
                        暂无奖项，点击右上角「新增奖项」开始配置
                      </div>
                    )}
                  </div>

                  {/* 右：实时预览（完全复刻用户端页面） */}
                  <div className="lg:col-span-1">
                    <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm p-4 sticky top-4">
                      <h3 className="font-bold text-sm text-[#0f172a] mb-3 tracking-wide">实时预览</h3>

                      {/* 手机屏幕模拟框 */}
                      <div
                        className="mx-auto rounded-xl overflow-hidden border border-[#e2e8f0] bg-[#f8fafc]"
                        style={{ width: '100%', maxWidth: 280, aspectRatio: '9/16' }}
                      >
                        <div style={{ width: 375, transformOrigin: 'top left', transform: `scale(${280 / 375})` }}>
                          {/* 页面内容区 */}
                          <div className="flex flex-col items-center justify-center px-6 pt-10 pb-6" style={{ minHeight: `${375 * 16 / 9}px`, background: 'linear-gradient(180deg, #f8fafc 0%, #f0f4ff 100%)' }}>

                            {/* 标题 */}
                            <div className="text-center mb-6">
                              <h2 className="text-xl font-bold tracking-widest text-[#1a2332]" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>{wheelTitle}</h2>
                              <p className="text-[#003cff]/70 text-[10px] mt-2 tracking-[0.2em]" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>{wheelSubtitle}</p>
                            </div>

                            {/* 转盘 */}
                            <div className="flex justify-center relative my-4">
                              {/* 指针 */}
                              <div
                                className="absolute -top-5 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center"
                                style={{ filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.12))' }}
                              >
                                <div className="w-2.5 h-2.5 rounded-full border-[2px] border-[#003cff] bg-white z-10 relative top-1.5" />
                                <div className="w-0 h-0 border-l-[9px] border-l-transparent border-r-[9px] border-r-transparent border-t-[28px] border-t-[#003cff]" />
                              </div>

                              {/* 转盘容器 */}
                              <div
                                className="relative w-[260px] h-[260px] rounded-full bg-[#fdfdfc] border-[6px] border-white flex items-center justify-center overflow-hidden ring-1 ring-[#003cff]/10"
                                style={{ boxShadow: '0 10px 30px rgba(0,30,100,0.12)' }}
                              >
                                <div className="absolute inset-0 rounded-full border border-[#003cff]/20 pointer-events-none m-1.5" />
                                <div className="absolute inset-0 rounded-full border border-dashed border-[#003cff]/30 pointer-events-none m-3" />

                                <div className="w-full h-full rounded-full absolute inset-0">
                                  <svg width="100%" height="100%" viewBox="0 0 260 260">
                                    {previewPrizes.length > 0 ? previewPrizes.map((p, i) => {
                                      const sliceAngle = 360 / previewPrizes.length;
                                      const startAngle = i * sliceAngle - 90 - sliceAngle / 2;
                                      const endAngle = startAngle + sliceAngle;
                                      const pathData = createSlice(130, 130, 130, startAngle, endAngle);
                                      const textArcData = createTextArc(130, 130, 107, startAngle, endAngle);
                                      const fill = i % 2 === 0 ? '#ffffff' : '#f5f8ff';
                                      const PIcon = IconMap[p.description || ''] || Gift;
                                      const rotDeg = i * sliceAngle;
                                      return (
                                        <g key={p.id}>
                                          <path d={pathData} fill={fill} stroke="#003cff" strokeWidth="0.5" strokeOpacity="0.2" />
                                          <path id={`pv-arc-${i}`} d={textArcData} fill="none" />
                                          <text fill="#003cff" fontSize="11" fontWeight="bold" letterSpacing="1.5" fontFamily="Georgia, serif">
                                            <textPath href={`#pv-arc-${i}`} startOffset="50%" textAnchor="middle">
                                              {p.name}
                                            </textPath>
                                          </text>
                                          <g transform={`translate(130,130) rotate(${rotDeg})`}>
                                            <foreignObject x={-10} y={-82} width="20" height="20" style={{ overflow: 'visible' }}>
                                              <div style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <PIcon size={14} color="#003cff" strokeWidth={1.8} />
                                              </div>
                                            </foreignObject>
                                            <circle cx="0" cy={-97} r="1.5" fill="#003cff" opacity="0.3" />
                                          </g>
                                        </g>
                                      );
                                    }) : (
                                      <circle cx="130" cy="130" r="130" fill="#f5f8ff" />
                                    )}
                                  </svg>
                                </div>

                                {/* 中心按钮 */}
                                <div
                                  className="absolute w-16 h-16 bg-white rounded-full z-20 flex items-center justify-center border-[3px] border-[#f0f4ff]"
                                  style={{ boxShadow: '0 8px 16px rgba(0,30,100,0.12)' }}
                                >
                                  <div
                                    className="w-11 h-11 rounded-full bg-[#003cff] flex flex-col items-center justify-center relative overflow-hidden"
                                    style={{ boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.4)' }}
                                  >
                                    <div className="absolute top-0 left-0 w-full h-1/2 bg-white/20 rounded-t-full pointer-events-none" />
                                    <Sparkles className="w-4 h-4 text-white mb-0.5" strokeWidth={1.5} />
                                    <span className="text-white text-[7px] tracking-[0.15em] mt-0.5" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
                                      开始
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* 底部品牌 */}
                            <div className="mt-auto pt-8 flex flex-col items-center gap-1" style={{ opacity: 0.5 }}>
                              <img src="/logo_24.svg" alt="Unilumin" className="h-4" />
                              <p className="text-[#003cff] text-[7px] tracking-[0.15em] uppercase" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
                                {footerText}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 奖品库存列表 */}
                      <div className="mt-3 space-y-1.5">
                        {prizes.map(p => {
                          const ep = p.id === editingPrize ? { ...p, name: editForm.name, description: editForm.description } : p;
                          const Icon = IconMap[ep.description || ''] || Gift;
                          return (
                            <div key={p.id} className="flex items-center justify-between text-xs py-1">
                              <div className="flex items-center gap-2">
                                <Icon size={14} className="text-[#003cff]" />
                                <span className="text-[#0f172a] font-medium">{ep.name}</span>
                              </div>
                              <span className={`font-bold ${p.remaining > 0 ? 'text-[#003cff]' : 'text-[#ef4444]'}`}>
                                {p.remaining > 0 ? `×${p.remaining}` : '已抽完'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-[#94a3b8] mt-2 text-center">库存为 0 的奖项不会出现在转盘上</p>
                    </div>
                  </div>
                </div>
              </div>
              );
            })()}
            {activeTab === 'pageConfig' && (
              <div className="animate-retro-fade">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* 左侧：配置区 */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-black tracking-widest text-[#0f172a]" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>页面配置</h2>
                      <button
                        onClick={async () => {
                          const ok = await updateProject(eventId, {
                              settings: { wheelTitle, wheelSubtitle, formTitle, formSubtitle, formButtonText, footerText, formTitleEn, formSubtitleEn, formButtonTextEn, footerTextEn, formFields }
                          });
                          if (ok) showToast('✅ 配置已保存');
                        }}
                        className="px-4 py-2 bg-[#003cff] text-white text-sm font-bold rounded-lg hover:bg-[#0030cc] transition-all"
                      >
                        💾 保存配置
                      </button>
                    </div>

                    {/* 登录页标题配置 */}
                    <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm p-4">
                      <h3 className="font-bold text-sm text-[#0f172a] mb-1">📋 标题与按钮</h3>
                      <p className="text-[10px] text-[#94a3b8] mb-3">每项均支持中英双语，切换语言时自动显示对应版本</p>
                      <div className="space-y-3">
                        {/* 主标题 */}
                        <div>
                          <label className="text-[11px] text-[#64748b] font-bold block mb-1">主标题 / Main Title</label>
                          <div className="grid grid-cols-2 gap-2">
                            <input type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="中文（如：展区抽奖）"
                              className="w-full bg-[#f8fafc] border border-[#cbd5e1] px-2.5 py-1.5 rounded-lg text-sm outline-none focus:border-[#003cff] text-[#0f172a]" />
                            <input type="text" value={formTitleEn} onChange={e => setFormTitleEn(e.target.value)} placeholder="English (e.g. Lucky Draw)"
                              className="w-full bg-[#f8fafc] border border-[#e2e8f0] px-2.5 py-1.5 rounded-lg text-sm outline-none focus:border-[#003cff] text-[#64748b]" />
                          </div>
                        </div>
                        {/* 副标题 */}
                        <div>
                          <label className="text-[11px] text-[#64748b] font-bold block mb-1">副标题 / Subtitle</label>
                          <div className="grid grid-cols-2 gap-2">
                            <input type="text" value={formSubtitle} onChange={e => setFormSubtitle(e.target.value)} placeholder="副标题"
                              className="w-full bg-[#f8fafc] border border-[#cbd5e1] px-2.5 py-1.5 rounded-lg text-sm outline-none focus:border-[#003cff] text-[#0f172a]" />
                            <input type="text" value={formSubtitleEn} onChange={e => setFormSubtitleEn(e.target.value)} placeholder="English subtitle"
                              className="w-full bg-[#f8fafc] border border-[#e2e8f0] px-2.5 py-1.5 rounded-lg text-sm outline-none focus:border-[#003cff] text-[#64748b]" />
                          </div>
                        </div>
                        {/* 按钮文字 */}
                        <div>
                          <label className="text-[11px] text-[#64748b] font-bold block mb-1">按钮文字 / Button</label>
                          <div className="grid grid-cols-2 gap-2">
                            <input type="text" value={formButtonText} onChange={e => setFormButtonText(e.target.value)} placeholder="登记并参与抽奖"
                              className="w-full bg-[#f8fafc] border border-[#cbd5e1] px-2.5 py-1.5 rounded-lg text-sm outline-none focus:border-[#003cff] text-[#0f172a]" />
                            <input type="text" value={formButtonTextEn} onChange={e => setFormButtonTextEn(e.target.value)} placeholder="Register & Draw"
                              className="w-full bg-[#f8fafc] border border-[#e2e8f0] px-2.5 py-1.5 rounded-lg text-sm outline-none focus:border-[#003cff] text-[#64748b]" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 表单字段开关 */}
                    <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm p-4">
                      <h3 className="font-bold text-sm text-[#0f172a] mb-3">📝 表单字段</h3>
                      <p className="text-[11px] text-[#94a3b8] mb-3">控制用户填写哪些信息，可自定义每个字段的显示名称</p>
                      <div className="space-y-2">
                        {formFields.map((field, idx) => (
                          <div key={field.key} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${field.enabled ? 'border-[#003cff]/20 bg-[#f0f4ff]' : 'border-[#e2e8f0] bg-[#f8fafc] opacity-50'}`}>
                            {/* 启用开关 */}
                            <button
                              onClick={() => {
                                if (field.locked) return;
                                setFormFields(prev => prev.map((f, i) => i === idx ? { ...f, enabled: !f.enabled } : f));
                              }}
                              className={`w-10 h-[22px] rounded-full relative shrink-0 transition-all ${field.locked ? 'cursor-not-allowed' : 'cursor-pointer'} ${field.enabled ? 'bg-[#003cff]' : 'bg-[#cbd5e1]'}`}
                            >
                              <div className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-all ${field.enabled ? 'left-[22px]' : 'left-[3px]'}`} />
                            </button>
                            {/* 标签编辑：中/英 */}
                            <div className="flex-1 min-w-0 space-y-1">
                              <input
                                type="text"
                                value={field.label}
                                onChange={e => setFormFields(prev => prev.map((f, i) => i === idx ? { ...f, label: e.target.value } : f))}
                                className="w-full bg-transparent border-b border-[#003cff]/10 outline-none text-sm text-[#0f172a] font-medium"
                                placeholder="中文字段名"
                              />
                              <input
                                type="text"
                                value={field.labelEn || ''}
                                onChange={e => setFormFields(prev => prev.map((f, i) => i === idx ? { ...f, labelEn: e.target.value } : f))}
                                className="w-full bg-transparent border-b border-[#e2e8f0] outline-none text-xs text-[#94a3b8]"
                                placeholder="English label"
                              />
                            </div>
                            {/* 必填/选填切换 */}
                            {field.enabled && (
                              field.locked ? (
                                <span className="text-[10px] bg-[#003cff]/10 text-[#003cff] px-2 py-1 rounded-md font-bold shrink-0">必填</span>
                              ) : (
                                <button
                                  onClick={() => setFormFields(prev => prev.map((f, i) => i === idx ? { ...f, required: !f.required } : f))}
                                  className={`text-[10px] px-2 py-1 rounded-md font-bold transition-all shrink-0 border ${field.required ? 'bg-red-50 text-red-600 border-red-200' : 'bg-[#f1f5f9] text-[#94a3b8] border-[#e2e8f0] hover:border-[#cbd5e1]'}`}
                                >
                                  {field.required ? '✱ 必填' : '选填'}
                                </button>
                              )
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 页脚配置 */}
                    <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm p-4">
                      <h3 className="font-bold text-sm text-[#0f172a] mb-3">🏷️ 页脚</h3>
                      <div>
                        <label className="text-[11px] text-[#64748b] font-bold block mb-1">页脚文字 / Footer</label>
                        <div className="grid grid-cols-2 gap-2">
                          <input type="text" value={footerText} onChange={e => setFooterText(e.target.value)} placeholder="ISLE 2026 LED光显科技展"
                            className="w-full bg-[#f8fafc] border border-[#cbd5e1] px-2.5 py-1.5 rounded-lg text-sm outline-none focus:border-[#003cff] text-[#0f172a]" />
                          <input type="text" value={footerTextEn} onChange={e => setFooterTextEn(e.target.value)} placeholder="ISLE 2026 LED Display Technology"
                            className="w-full bg-[#f8fafc] border border-[#e2e8f0] px-2.5 py-1.5 rounded-lg text-sm outline-none focus:border-[#003cff] text-[#64748b]" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 右侧：实时预览 */}
                  <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm p-4">
                    <h3 className="font-bold text-sm text-[#0f172a] mb-3">📱 登录页预览</h3>
                    <div
                      className="mx-auto rounded-xl overflow-hidden border border-[#e2e8f0] bg-[#f8fafc]"
                      style={{ width: '100%', maxWidth: 280, aspectRatio: '9/16' }}
                    >
                      <div style={{ width: 375, transformOrigin: 'top left', transform: `scale(${280 / 375})` }}>
                        <div className="flex flex-col items-center justify-center px-6 pt-14 pb-6" style={{ minHeight: `${375 * 16 / 9}px`, background: 'linear-gradient(180deg, #f8fafc 0%, #f0f4ff 100%)' }}>
                          {/* 标题 */}
                          <div className="text-center space-y-2 mb-8">
                            <h2 className="text-2xl font-black tracking-wider text-[#1a2332]" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>{formTitle}</h2>
                            <div className="flex items-center justify-center gap-2 opacity-60">
                              <span className="w-6 h-[1px] bg-[#003cff]" />
                              <p className="text-[#003cff] text-[8px] tracking-[0.12em] uppercase whitespace-nowrap" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>{formSubtitle}</p>
                              <span className="w-6 h-[1px] bg-[#003cff]" />
                            </div>
                          </div>
                          {/* 表单 - 动态字段 */}
                          <div className="w-full bg-white/60 backdrop-blur-xl p-6 rounded-xl border border-[#003cff]/10 space-y-4">
                            {formFields.filter(f => f.enabled).map(f => (
                              <div key={f.key} className="border-b border-[#003cff]/15 pb-3">
                                <span className="text-[#94a3b8] text-sm text-center block" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
                                  {f.label}{f.required && <span className="text-red-400 ml-0.5">*</span>}
                                </span>
                              </div>
                            ))}
                            <div className="bg-[#003cff] text-white text-center py-3 rounded text-sm font-bold tracking-widest mt-4" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
                              {formButtonText}
                            </div>
                          </div>
                          {/* 页脚 */}
                          <div className="mt-auto pt-10 flex flex-col items-center gap-1" style={{ opacity: 0.5 }}>
                            <img src="/logo_24.svg" alt="Logo" className="h-4" />
                            <p className="text-[#003cff] text-[7px] tracking-[0.15em] uppercase" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
                              {footerText}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 移动端底部 Tab 导航 ── */}
      <div className="md:hidden shrink-0 flex bg-white border-t border-[#e2e8f0]">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 text-[10px] font-bold transition-colors
              ${activeTab === item.id ? 'text-[#003cff]' : 'text-[#94a3b8]'}`}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
      {/* Toast 提示 */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] animate-fade-in-up">
          <div className="bg-[#0f172a] text-white px-5 py-2.5 rounded-full shadow-lg text-sm font-bold">
            {toast}
          </div>
        </div>
      )}

      {/* ── 核销确认弹窗（全局层级） ── */}
      {lookupWinner && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setLookupWinner(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-fade-in-up" onClick={e => e.stopPropagation()}>
            {/* 弹窗头部 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#e2e8f0] bg-[#f8fafc]">
              <h3 className="font-bold text-[#0f172a] text-lg">核销确认</h3>
              <button onClick={() => setLookupWinner(null)} className="text-[#94a3b8] hover:text-[#0f172a] transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* 弹窗内容 */}
            <div className="p-5 space-y-4">
              {/* 奖品信息 */}
              {(() => {
                const PIco = IconMap[lookupWinner.prize?.description || ''] || Gift;
                return (
                  <div className="flex items-center gap-3 p-4 bg-[#f0f4ff] rounded-xl">
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center border border-[#003cff]/10">
                      <PIco size={24} className="text-[#003cff]" />
                    </div>
                    <div>
                      <p className="font-bold text-[#003cff] text-lg">{lookupWinner.prize?.name || '未知奖项'}</p>
                      <p className="text-xs text-[#64748b]">奖品</p>
                    </div>
                  </div>
                );
              })()}

              {/* 用户信息 */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-2 border-b border-[#f1f5f9]">
                  <span className="text-[#64748b]">姓名</span>
                  <span className="font-bold text-[#0f172a]">{lookupWinner.name}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-[#f1f5f9]">
                  <span className="text-[#64748b]">手机号</span>
                  <span className="font-bold text-[#0f172a]">{lookupWinner.phone}</span>
                </div>
                {lookupWinner.company && (
                  <div className="flex justify-between py-2 border-b border-[#f1f5f9]">
                    <span className="text-[#64748b]">公司</span>
                    <span className="font-bold text-[#0f172a]">{lookupWinner.company}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b border-[#f1f5f9]">
                  <span className="text-[#64748b]">兑换码</span>
                  <span className="font-bold text-[#003cff] font-mono">{lookupWinner.redeem_code}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-[#f1f5f9]">
                  <span className="text-[#64748b]">中奖时间</span>
                  <span className="text-[#0f172a]">{new Date(lookupWinner.won_at).toLocaleString('zh-CN')}</span>
                </div>
              </div>

              {/* 核销状态与操作 */}
              {lookupWinner.status === 'redeemed' ? (
                <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl p-4 text-center">
                  <CheckCircle2 className="w-8 h-8 text-[#00cb35] mx-auto mb-2" />
                  <p className="font-bold text-[#00cb35] text-sm">该奖品已核销</p>
                  {lookupWinner.redeemed_at && (
                    <p className="text-xs text-[#64748b] mt-1">
                      核销时间：{new Date(lookupWinner.redeemed_at).toLocaleString('zh-CN')}
                    </p>
                  )}
                </div>
              ) : (
                <button
                  onClick={confirmRedeem}
                  className="w-full py-3 bg-[#003cff] text-white rounded-xl font-bold text-sm hover:bg-[#0030cc] transition-all active:scale-[0.98]"
                >
                  ✅ 确认核销
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
