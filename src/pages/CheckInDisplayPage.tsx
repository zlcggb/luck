import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  QrCode, 
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
  getCheckInSessionStatus,
  resetCheckInStatusForEvent,
  initDefaultParticipants,
  clearAllParticipantsForEvent,
  checkIsEventAdmin,
} from '../utils/supabaseCheckin';
import { CheckInSettings } from '../types/checkin';
import { loadCheckInSettings, clearCheckInRecords } from '../utils/checkinStorage';
import { loadProjectSettings, saveProjectSettings, getEmployeeIdPrefixFromSettings } from '../utils/projectSettings';

import CheckInStats from '../components/checkin/CheckInStats';
import RealtimeFeed from '../components/checkin/RealtimeFeed';
import CheckInDisplayHeader, { formatCheckInRemainingTime } from '../components/checkin/CheckInDisplayHeader';
import CheckInQrModal from '../components/checkin/CheckInQrModal';
import CheckInManagementModal from '../components/checkin/CheckInManagementModal';
import { useUiAppearance } from '../contexts/UiAppearanceContext';

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
  const [isAdmin, setIsAdmin] = useState<boolean>(searchParams.get('mode') === 'admin');
  const [records, setRecords] = useState<LuckCheckIn[]>([]);
  const [settings, setSettings] = useState<CheckInSettings | null>(null);
  const [_isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showManagementModal, setShowManagementModal] = useState(false);
  const [actionError, setActionError] = useState('');
  const [participantListCount, setParticipantListCount] = useState(0);
  const [employeeIdPrefix, setEmployeeIdPrefix] = useState('U');

  // 签到会话管理状态
  const [showStartModal, setShowStartModal] = useState(false);
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

        // 异步检查管理员权限
        const isOwnerOrAdmin = await checkIsEventAdmin(activeEvent.id);
        const resolvedIsAdmin = isOwnerOrAdmin || searchParams.get('mode') === 'admin';
        setIsAdmin(resolvedIsAdmin);
        
        // 获取签到记录
        const checkIns = await getCheckInRecords(activeEvent.id, 50);
        setRecords(checkIns);
        
        // 获取签到人数
        const count = await getCheckInCount(activeEvent.id);
        
        // 从数据库获取参与者总数
        const totalCount = await getParticipantCount(activeEvent.id);
        setParticipantListCount(totalCount || 0);

        // 加载项目自定义设置（目标总人数及工号前缀）
        const dbSettings = await loadProjectSettings(activeEvent.id);
        const configuredTarget = typeof dbSettings?.targetParticipants === 'number' && dbSettings.targetParticipants > 0
          ? dbSettings.targetParticipants
          : (totalCount || 100);
        const configuredPrefix = getEmployeeIdPrefixFromSettings(dbSettings);
        setEmployeeIdPrefix(configuredPrefix);
        
        // 更新统计
        updateStats(checkIns, count, configuredTarget);
        
        // 检查签到会话状态
        const sessionStatus = await getCheckInSessionStatus(activeEvent.id);
        if (sessionStatus.isOpen) {
          setCheckInOpen(true);
          setShowStartModal(false);
          if (sessionStatus.remainingSeconds) {
            setRemainingTime(sessionStatus.remainingSeconds);
          }
        } else if (resolvedIsAdmin) {
          // 仅管理员且未开启时提示开启弹窗
          setShowStartModal(true);
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

  const lastSoundTimeRef = useRef<number>(0);

  // 播放签到提示音（限制最小间隔 200ms）
  const playCheckInSound = () => {
    const now = Date.now();
    if (now - lastSoundTimeRef.current < 200) return;
    lastSoundTimeRef.current = now;

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

  // 实时订阅签到记录 + HTTP 反向代理增量轮询双通道（防止移动热点/防火墙阻断 WebSocket）
  useEffect(() => {
    if (!event) return;

    let isMounted = true;

    const handleIncomingCheckIn = (newCheckIn: LuckCheckIn) => {
      setRecords(prev => {
        if (prev.some(r => r.id === newCheckIn.id || (r.employee_id === newCheckIn.employee_id && r.event_id === newCheckIn.event_id))) {
          return prev;
        }
        if (soundEnabled) {
          playCheckInSound();
        }
        setStats(prevStats => ({
          ...prevStats,
          checkedInCount: prevStats.checkedInCount + 1,
          checkInPercentage: Math.round(((prevStats.checkedInCount + 1) / prevStats.totalParticipants) * 100),
          lastCheckInTime: newCheckIn.check_in_time,
        }));
        return [newCheckIn, ...prev];
      });
    };

    const unsubscribe = subscribeToCheckIns(event.id, handleIncomingCheckIn);

    const pollInterval = setInterval(async () => {
      try {
        const latestCheckIns = await getCheckInRecords(event.id, 30);
        if (!isMounted || latestCheckIns.length === 0) return;
        // 从旧到新依次尝试合并，确保最新签到排在最前并触发动画
        for (let i = latestCheckIns.length - 1; i >= 0; i -= 1) {
          handleIncomingCheckIn(latestCheckIns[i]);
        }
      } catch {
        // 静默忽略轮询瞬断
      }
    }, 3000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, soundEnabled]);

  // 处理新签到（保留作为备用）


  // 刷新数据
  const refreshData = async () => {
    if (!event) return;

    setActionError('');
    try {
      const checkIns = await getCheckInRecords(event.id, 50);
      const count = await getCheckInCount(event.id);
      const totalCount = await getParticipantCount(event.id);
      setRecords(checkIns);
      updateStats(checkIns, count, totalCount || undefined);
    } catch {
      setActionError('刷新失败，已保留当前数据');
    }
  };

  // 修改并保存目标签到总人数
  const handleSaveTotalParticipants = async (newTotal: number) => {
    if (!event || newTotal <= 0) return;
    setActionError('');
    try {
      await saveProjectSettings(event.id, { targetParticipants: newTotal });
      setStats(prev => ({
        ...prev,
        totalParticipants: newTotal,
        checkInPercentage: Math.round((prev.checkedInCount / newTotal) * 100),
      }));
    } catch {
      setActionError('保存总人数失败，请稍后重试');
    }
  };

  // 修改并保存工号前缀
  const handleSaveEmployeeIdPrefix = async (newPrefix: string) => {
    if (!event) return;
    setActionError('');
    try {
      await saveProjectSettings(event.id, { employeeIdPrefix: newPrefix });
      setEmployeeIdPrefix(newPrefix);
    } catch {
      setActionError('保存工号前缀失败，请稍后重试');
    }
  };

  // 清除已签到记录（重置为未签到状态）
  const handleResetCheckIns = async () => {
    if (!event) return;
    setActionError('');
    try {
      const success = await resetCheckInStatusForEvent(event.id);
      if (!success) throw new Error('reset failed');

      // 本地缓存同步清空
      clearCheckInRecords();

      // 重置大屏状态
      setRecords([]);
      setStats(prev => ({
        ...prev,
        checkedInCount: 0,
        checkInPercentage: 0,
        lastCheckInTime: undefined,
        departmentStats: [],
      }));
    } catch {
      setActionError('清除已签到记录失败，请重试');
    }
  };

  // 初始化标准演示名单并直接完成签到入场
  const handleInitSampleParticipants = async (count: number = 30, prefix?: string) => {
    if (!event) return;
    setActionError('');
    try {
      const res = await initDefaultParticipants(event.id, count, prefix || employeeIdPrefix);
      if (!res.success) throw new Error(res.error || 'init sample failed');

      // 刷新名单总人数与签到记录
      setParticipantListCount(res.count);
      await refreshData();
    } catch {
      setActionError('初始化演示名单失败，请重试');
    }
  };

  // 清空全部参会人员名单
  const handleClearAllParticipants = async () => {
    if (!event) return;
    setActionError('');
    try {
      const success = await clearAllParticipantsForEvent(event.id);
      if (!success) throw new Error('clear all failed');

      setParticipantListCount(0);
      await handleResetCheckIns();
    } catch {
      setActionError('清空参会人员失败，请重试');
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
          onStart={isAdmin ? () => setShowStartModal(true) : undefined}
          onEnd={isAdmin ? () => setShowEndConfirm(true) : undefined}
          onRefresh={() => void refreshData()}
          onToggleSound={() => setSoundEnabled(current => !current)}
          onShowQr={() => setShowQRModal(true)}
          onToggleFullscreen={toggleFullscreen}
          onOpenManagement={isAdmin ? () => setShowManagementModal(true) : undefined}
        />

        {actionError && (
          <p role="alert" className="checkin-action-error">
            {actionError}
          </p>
        )}

        {/* 主体区域 */}
        <main className="checkin-stage-grid">
          
          {/* 左侧：实时下雨动态掉落签到池 */}
          <div className="checkin-stage-panel checkin-live-panel">
            <RealtimeFeed 
              records={convertedRecords}
              maxDisplay={100}
            />
          </div>

          {/* 右侧：右上二维码 + 右下人数统计看板 */}
          <aside className="checkin-stage-sidebar">
            <CheckInStats 
              totalParticipants={stats.totalParticipants}
              checkedInCount={stats.checkedInCount}
              checkInPercentage={stats.checkInPercentage}
              lastCheckInTime={stats.lastCheckInTime}
              variant="large"
              onEditTotal={isAdmin ? () => setShowManagementModal(true) : undefined}
              checkInUrl={getCheckInUrl()}
              checkInOpen={checkInOpen}
              onOpenQrModal={() => setShowQRModal(true)}
              onStartCheckIn={isAdmin ? () => setShowStartModal(true) : undefined}
            />
          </aside>
        </main>
      </div>

      <CheckInQrModal
        open={showQRModal}
        eventName={event?.name || settings?.eventName || '年度盛典'}
        checkInUrl={getCheckInUrl()}
        remainingLabel={checkInOpen && remainingTime !== null ? formatCheckInRemainingTime(remainingTime) : null}
        onClose={() => setShowQRModal(false)}
      />

      <CheckInManagementModal
        open={showManagementModal}
        totalParticipants={stats.totalParticipants}
        checkedInCount={stats.checkedInCount}
        participantListCount={participantListCount}
        employeeIdPrefix={employeeIdPrefix}
        onClose={() => setShowManagementModal(false)}
        onSaveTotalParticipants={handleSaveTotalParticipants}
        onSaveEmployeeIdPrefix={handleSaveEmployeeIdPrefix}
        onResetCheckIns={handleResetCheckIns}
        onInitSampleParticipants={handleInitSampleParticipants}
        onClearAllParticipants={handleClearAllParticipants}
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
