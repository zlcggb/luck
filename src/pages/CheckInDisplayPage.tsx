import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  QrCode, 
  Sparkles, 
  RefreshCw,
  Check,
  Play,
} from 'lucide-react';
import { 
  LuckEvent,
  LuckCheckIn,
  getActiveEvent,
  getEvent,
  getCheckInRecords,
  getCheckInCount,
  getParticipantCount,
  subscribeToCheckIns,
  startCheckInSession,
  endCheckInSession,
  getCheckInSessionStatus
} from '../utils/supabaseCheckin';
import { CheckInSettings } from '../types/checkin';
import { loadCheckInSettings } from '../utils/checkinStorage';

import CheckInStats from '../components/checkin/CheckInStats';
import RealtimeFeed from '../components/checkin/RealtimeFeed';
import CheckInDisplayHeader, { formatCheckInRemainingTime } from '../components/checkin/CheckInDisplayHeader';
import CheckInQrModal from '../components/checkin/CheckInQrModal';
import { useUiAppearance } from '../contexts/UiAppearanceContext';

// 祝福语列表
const GREETINGS = [
  '欢迎参加年度盛典',
  '祝您今晚好运连连',
  '愿您今晚满载而归',
  '欢迎开启幸运之旅',
  '欢迎来到活动现场',
];

// 签到时长选项（分钟）
const DURATION_OPTIONS = [
  { label: '5 分钟', value: 5 },
  { label: '10 分钟', value: 10 },
  { label: '15 分钟', value: 15 },
  { label: '30 分钟', value: 30 },
  { label: '60 分钟', value: 60 },
  { label: '不限时', value: 0 },
];

interface CheckInDisplayPageProps {
  onBack?: () => void;
  eventId?: string | null;
}

/**
 * 签到大屏展示页面
 * 连接 Supabase 数据库，实时展示签到动态
 */
const CheckInDisplayPage = ({ onBack, eventId: propEventId }: CheckInDisplayPageProps) => {
  const { appearance } = useUiAppearance();
  // 从 URL 读取 event 参数（fallback）
  const [searchParams] = useSearchParams();
  const urlEventId = searchParams.get('event');
  // 优先使用 prop 传入的，其次用 URL 参数
  const targetEventId = propEventId || urlEventId;
  // 状态
  const [event, setEvent] = useState<LuckEvent | null>(null);
  const [records, setRecords] = useState<LuckCheckIn[]>([]);
  const [settings, setSettings] = useState<CheckInSettings | null>(null);
  const [latestRecord, setLatestRecord] = useState<LuckCheckIn | null>(null);
  const [showLatestAnimation, setShowLatestAnimation] = useState(false);
  const [greeting, setGreeting] = useState('');
  const [_isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [actionError, setActionError] = useState('');

  
  // 签到队列：支持多人同时签到时依次展示
  const [checkInQueue, setCheckInQueue] = useState<LuckCheckIn[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  
  // 签到会话管理状态
  const [showStartModal, setShowStartModal] = useState(true); // 进入时显示开始弹窗
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [remainingTime, setRemainingTime] = useState<number | null>(null); // 剩余秒数
  const [selectedDuration, setSelectedDuration] = useState(15); // 默认15分钟
  const [isStarting, setIsStarting] = useState(false);
  
  const [stats, setStats] = useState({
    totalParticipants: 100,
    checkedInCount: 0,
    checkInPercentage: 0,
    departmentStats: [] as { department: string; total: number; checkedIn: number; percentage: number }[],
    lastCheckInTime: undefined as string | undefined,
  });

  // 签到页面 URL（包含活动 ID）
  const getCheckInUrl = () => {
    const baseUrl = window.location.origin;
    // 如果有活动 ID，添加到 URL 参数
    if (event?.id) {
      return `${baseUrl}/checkin?event=${event.id}`;
    }
    return `${baseUrl}/checkin`;
  };

  // 初始化加载数据
  useEffect(() => {
    const init = async () => {
      // 加载本地设置
      const savedSettings = loadCheckInSettings();
      setSettings(savedSettings);
      
      // 获取活动信息：优先使用 eventId 参数，否则获取全局 active 活动
      let activeEvent: LuckEvent | null = null;
      if (targetEventId) {
        activeEvent = await getEvent(targetEventId);
      }
      if (!activeEvent) {
        activeEvent = await getActiveEvent();
      }
      
      if (activeEvent) {
        setEvent(activeEvent);
        
        // 获取签到记录
        const checkIns = await getCheckInRecords(activeEvent.id, 50);
        setRecords(checkIns);
        setLatestRecord(checkIns[0] ?? null);
        
        // 获取签到人数
        const count = await getCheckInCount(activeEvent.id);
        
        // 从数据库获取参与者总数
        const totalCount = await getParticipantCount(activeEvent.id);
        
        // 更新统计
        updateStats(checkIns, count, totalCount || 100);
        
        // 检查签到会话状态
        const sessionStatus = await getCheckInSessionStatus(activeEvent.id);
        if (sessionStatus.isOpen) {
          setCheckInOpen(true);
          setShowStartModal(false);
          if (sessionStatus.remainingSeconds) {
            setRemainingTime(sessionStatus.remainingSeconds);
          }
        }
      }
    };

    init();
  }, [targetEventId]);

  // 倒计时逻辑
  useEffect(() => {
    if (!checkInOpen || remainingTime === null) return;

    if (remainingTime <= 0) {
      // 倒计时结束，自动关闭签到
      handleEndCheckIn();
      return;
    }

    const timer = setInterval(() => {
      setRemainingTime(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [checkInOpen, remainingTime]);

  // 开始签到
  const handleStartCheckIn = async () => {
    if (!event) return;

    setActionError('');
    setIsStarting(true);
    try {
      const result = await startCheckInSession(event.id, selectedDuration);
      if (!result.success) throw new Error(result.error || 'start failed');
      setCheckInOpen(true);
      setShowStartModal(false);
      if (selectedDuration > 0) {
        setRemainingTime(selectedDuration * 60);
      } else {
        setRemainingTime(null);
      }
    } catch {
      setActionError('开始签到失败，请稍后重试');
    } finally {
      setIsStarting(false);
    }
  };

  // 结束签到
  const handleEndCheckIn = async () => {
    if (!event) return;

    setActionError('');
    try {
      const success = await endCheckInSession(event.id);
      if (!success) throw new Error('end failed');
      setCheckInOpen(false);
      setRemainingTime(null);
      setShowEndConfirm(false);
    } catch {
      setActionError('结束签到失败，请稍后重试');
    }
  };

  // 更新统计数据
  const updateStats = (checkIns: LuckCheckIn[], count: number, totalParticipants?: number) => {
    const total = totalParticipants || stats.totalParticipants || 100;
    
    // 按部门统计
    const deptMap = new Map<string, { total: number; checkedIn: number }>();
    checkIns.forEach(c => {
      const dept = c.department || '未知部门';
      if (!deptMap.has(dept)) {
        deptMap.set(dept, { total: 0, checkedIn: 0 });
      }
      deptMap.get(dept)!.checkedIn++;
      deptMap.get(dept)!.total++;
    });

    const departmentStats = Array.from(deptMap.entries()).map(([department, deptStats]) => ({
      department,
      total: deptStats.total,
      checkedIn: deptStats.checkedIn,
      percentage: 100,
    })).sort((a, b) => b.checkedIn - a.checkedIn);

    setStats({
      totalParticipants: total,
      checkedInCount: count,
      checkInPercentage: Math.round((count / total) * 100),
      departmentStats,
      lastCheckInTime: checkIns.length > 0 ? checkIns[0].check_in_time : undefined,
    });
  };

  // 实时订阅签到记录
  useEffect(() => {
    if (!event) return;

    const unsubscribe = subscribeToCheckIns(event.id, (newCheckIn) => {
      setRecords(prev => [newCheckIn, ...prev.slice(0, 49)]);
      // setCheckInCount(prev => prev + 1) removed
      
      // 加入队列而不是直接展示
      setCheckInQueue(prev => [...prev, newCheckIn]);
      
      // 更新统计
      setStats(prev => ({
        ...prev,
        checkedInCount: prev.checkedInCount + 1,
        checkInPercentage: Math.round(((prev.checkedInCount + 1) / prev.totalParticipants) * 100),
        lastCheckInTime: newCheckIn.check_in_time,
      }));
    });

    return unsubscribe;
  }, [event]);

  // 处理签到队列：依次展示每个签到
  useEffect(() => {
    if (checkInQueue.length === 0 || isProcessingQueue) return;
    
    setIsProcessingQueue(true);
    
    // 取出队列中的第一个
    const nextCheckIn = checkInQueue[0];
    setLatestRecord(nextCheckIn);
    setGreeting(GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);
    setShowLatestAnimation(true);
    
    // 播放提示音
    if (soundEnabled) {
      playCheckInSound();
    }
    
    // 3秒后隐藏动画并处理下一个
    setTimeout(() => {
      setShowLatestAnimation(false);
      setCheckInQueue(prev => prev.slice(1)); // 移除已处理的
      setIsProcessingQueue(false);
    }, 3000);
  }, [checkInQueue, isProcessingQueue, soundEnabled]);

  // 处理新签到（保留作为备用）


  // 播放签到提示音
  const playCheckInSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(1200, audioContext.currentTime + 0.2);
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.error('播放提示音失败:', error);
    }
  };

  // 刷新数据
  const refreshData = async () => {
    if (!event) return;

    setActionError('');
    try {
      const checkIns = await getCheckInRecords(event.id, 50);
      const count = await getCheckInCount(event.id);
      const totalCount = await getParticipantCount(event.id);
      setRecords(checkIns);
      setLatestRecord(checkIns[0] ?? null);
      updateStats(checkIns, count, totalCount || undefined);
    } catch {
      setActionError('刷新失败，已保留当前数据');
    }
  };

  // 全屏切换
  const toggleFullscreen = () => {
    setActionError('');
    try {
      if (!document.fullscreenElement) {
        void document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        void document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      setActionError('当前浏览器无法进入全屏');
    }
  };

  // 获取当前时间
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 转换记录格式以兼容现有组件
  const convertedRecords = records.map(r => ({
    id: r.id,
    eventId: r.event_id,
    employeeId: r.employee_id,
    name: r.name,
    department: r.department || undefined,
    avatar: r.avatar || undefined,
    checkInTime: r.check_in_time,
    checkInMethod: r.check_in_method as 'qrcode' | 'manual',
    createdAt: r.created_at,
  }));

  return (
    <div className="checkin-stage vip-ui admin-ui relative min-h-screen w-full overflow-hidden" data-ui-theme={appearance}>
      <div className="checkin-stage-ambient is-blue" aria-hidden="true" />
      <div className="checkin-stage-ambient is-violet" aria-hidden="true" />
      <div className="checkin-stage-ambient is-magenta" aria-hidden="true" />

      {/* 主内容 */}
      <div className="checkin-stage-shell relative z-10 flex min-h-screen flex-col">
        
        <CheckInDisplayHeader
          eventName={event?.name || settings?.eventName || '年度盛典'}
          connected={Boolean(event)}
          checkInOpen={checkInOpen}
          remainingTime={remainingTime}
          currentTime={currentTime}
          soundEnabled={soundEnabled}
          onBack={onBack}
          onStart={() => setShowStartModal(true)}
          onEnd={() => setShowEndConfirm(true)}
          onRefresh={() => void refreshData()}
          onToggleSound={() => setSoundEnabled(current => !current)}
          onShowQr={() => setShowQRModal(true)}
          onToggleFullscreen={toggleFullscreen}
        />

        {actionError && (
          <p role="alert" className="checkin-action-error">
            {actionError}
          </p>
        )}

        {/* 主体区域 */}
        <main className="checkin-stage-grid">
          
          {/* 左侧：实时动态 */}
          <div className="checkin-stage-panel checkin-live-panel">
            <RealtimeFeed 
              records={convertedRecords}
              maxDisplay={settings?.maxDisplayCount || 15}
              animationStyle={settings?.animationStyle || 'slide'}
            />
          </div>

          {/* 右侧：统计 + 最新签到 */}
          <aside className="checkin-stage-sidebar">
            
            {/* 统计信息 */}
            <CheckInStats 
              totalParticipants={stats.totalParticipants}
              checkedInCount={stats.checkedInCount}
              checkInPercentage={stats.checkInPercentage}
              lastCheckInTime={stats.lastCheckInTime}
              departmentStats={stats.departmentStats}
              showDepartmentStats={settings?.showDepartmentStats ?? true}
              variant="large"
            />

          </aside>
        </main>
      </div>

      {/* 新签到弹出动画 */}
      {showLatestAnimation && latestRecord && (
        <div className="vip-modal-backdrop checkin-welcome-backdrop fixed inset-0 z-50 flex items-center justify-center animate-fadeIn">
          <div className="checkin-welcome-wrap relative animate-bounceIn">
            {/* 背景光效 */}
            <div className="checkin-welcome-glow" />
            
            {/* 卡片 */}
            <div className="checkin-welcome-card">
              {/* 顶部装饰 */}
              <div className="checkin-welcome-badge">
                <Sparkles size={16} />
                <span>签到成功</span>
              </div>
              
              {/* 头像 */}
              <div className="flex justify-center mb-6 mt-4">
                <div className="relative">
                  <img
                    src={latestRecord.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${latestRecord.employee_id}`}
                    alt={latestRecord.name}
                    className="checkin-welcome-avatar"
                  />
                  <div className="checkin-welcome-check animate-bounce">
                    <Check size={20} />
                  </div>
                </div>
              </div>
              
              {/* 信息 */}
              <div className="text-center">
                <h2 className="checkin-welcome-name">{latestRecord.name}</h2>
                <p className="checkin-welcome-department">{latestRecord.department || '未知部门'}</p>
                <p className="checkin-welcome-id">{latestRecord.employee_id}</p>
                
                {/* 祝福语 */}
                <div className="checkin-welcome-message">
                  <p>{greeting}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <CheckInQrModal
        open={showQRModal}
        eventName={event?.name || settings?.eventName || '年度盛典'}
        checkInUrl={getCheckInUrl()}
        remainingLabel={checkInOpen && remainingTime !== null ? formatCheckInRemainingTime(remainingTime) : null}
        onClose={() => setShowQRModal(false)}
      />

      {showEndConfirm && (
        <div className="vip-modal-backdrop fixed inset-0 z-50 grid place-items-center p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-label="确认结束签到" className="vip-modal ui-surface w-full max-w-sm rounded-3xl border p-7 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--ui-danger-soft)] text-[var(--ui-danger)]">
              <Check size={22} aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-[var(--ui-text)]">确认结束签到？</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--ui-text-muted)]">结束后，新扫码用户将无法继续签到。已登记记录不会被删除。</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setShowEndConfirm(false)} className="vip-button-secondary px-4 py-3 font-medium">继续签到</button>
              <button type="button" onClick={() => void handleEndCheckIn()} className="rounded-xl bg-[var(--ui-danger)] px-4 py-3 font-medium text-white">确认结束</button>
            </div>
          </section>
        </div>
      )}

      {/* 开始签到弹窗 */}
      {showStartModal && (
        <div className="vip-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 animate-modalFadeIn">
          {/* 背景遮罩 */}
          <div className="absolute inset-0" />
          
          {/* 弹窗内容 */}
          <div className="relative animate-modalSlideUp max-w-md w-full mx-4">
            {/* 主卡片 */}
            <div className="vip-modal relative p-8">
              {/* 图标 */}
              <div className="flex justify-center mb-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#3b82f6] shadow-[0_12px_28px_rgba(59,130,246,.24)]">
                  <QrCode size={40} className="text-white" />
                </div>
              </div>
              
              {/* 标题 */}
              <div className="text-center mb-8">
                <h2 className="mb-2 text-2xl font-semibold text-[var(--ui-text)]">签到管理</h2>
                <p className="text-[var(--ui-text-muted)]">{event?.name || '年度盛典'}</p>
              </div>
              
              {/* 时长选择 */}
              <div className="mb-8">
                <label className="mb-3 block text-sm font-medium text-[var(--ui-text-secondary)]">选择签到时长</label>
                <div className="grid grid-cols-3 gap-2">
                  {DURATION_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      onClick={() => setSelectedDuration(option.value)}
                      className={`py-3 px-4 rounded-xl text-sm font-medium transition-all ${
                        selectedDuration === option.value
                          ? 'bg-[#3b82f6] text-white shadow-[0_6px_18px_rgba(59,130,246,.22)]'
                          : 'border border-[var(--ui-border)] bg-[var(--ui-surface-soft)] text-[var(--ui-text-secondary)] hover:brightness-95'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* 按钮组 */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowStartModal(false);
                    // 仅查看模式，不开始签到
                  }}
                  className="vip-button-secondary flex-1 px-6 py-3 font-medium"
                >
                  仅查看记录
                </button>
                <button
                  onClick={handleStartCheckIn}
                  disabled={isStarting}
                  className="vip-button-primary flex flex-1 items-center justify-center gap-2 px-6 py-3 font-semibold disabled:opacity-50"
                >
                  {isStarting ? (
                    <>
                      <RefreshCw size={20} className="animate-spin" />
                      <span>开启中...</span>
                    </>
                  ) : (
                    <>
                      <Play size={20} />
                      <span>开始签到</span>
                    </>
                  )}
                </button>
              </div>
              
              {/* 提示 */}
              <p className="mt-6 text-center text-xs text-[var(--ui-text-muted)]">
                开始签到后，员工可扫描二维码进行签到
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 动画样式 */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes bounceIn {
          0% {
            opacity: 0;
            transform: scale(0.3) translateY(50px);
          }
          50% {
            transform: scale(1.05) translateY(-10px);
          }
          70% {
            transform: scale(0.95) translateY(5px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        
        .animate-bounceIn {
          animation: bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }
        
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
        
        /* Apple 风格弹窗动画 */
        @keyframes modalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes modalSlideUp {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(20px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        
        .animate-modalFadeIn {
          animation: modalFadeIn 0.25s ease-out forwards;
        }
        
        .animate-modalSlideUp {
          animation: modalSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default CheckInDisplayPage;
