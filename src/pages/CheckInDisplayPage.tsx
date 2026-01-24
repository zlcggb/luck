import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  QrCode, 
  Users, 
  Sparkles, 
  Clock, 
  MapPin,
  ArrowLeft,
  RefreshCw,
  Volume2,
  VolumeX,
  Maximize,
  X,
  ExternalLink,
  Copy,
  Check,
  Play,
  Square,
  Timer
} from 'lucide-react';
import { 
  LuckEvent,
  LuckCheckIn,
  getActiveEvent,
  getCheckInRecords,
  getCheckInCount,
  subscribeToCheckIns,
  startCheckInSession,
  endCheckInSession,
  getCheckInSessionStatus
} from '../utils/supabaseCheckin';
import { CheckInSettings } from '../types/checkin';
import { loadCheckInSettings, calculateStats } from '../utils/checkinStorage';

import CheckInStats from '../components/checkin/CheckInStats';
import RealtimeFeed from '../components/checkin/RealtimeFeed';

// 配置色系
const COLORS = {
  primary: '#3c80fa',
  secondary: '#573cfa',
  accent: '#b63cfa',
  success: '#22c55e',
  dark: '#0f0c29',
};

// 祝福语列表
const GREETINGS = [
  '欢迎参加年度盛典！🎉',
  '祝您好运连连！🍀',
  '愿您今晚满载而归！🎁',
  '开启幸运之旅！✨',
  '欢迎来到幸运之夜！🌟',
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
}

/**
 * 签到大屏展示页面
 * 连接 Supabase 数据库，实时展示签到动态
 */
const CheckInDisplayPage = ({ onBack }: CheckInDisplayPageProps) => {
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
  const [copied, setCopied] = useState(false);

  
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
      
      // 获取活动信息
      const activeEvent = await getActiveEvent();
      if (activeEvent) {
        setEvent(activeEvent);
        
        // 获取签到记录
        const checkIns = await getCheckInRecords(activeEvent.id, 50);
        setRecords(checkIns);
        
        // 获取签到人数
        const count = await getCheckInCount(activeEvent.id);
        // setCheckInCount(count) removed
        
        // 更新统计
        updateStats(checkIns, count);
        
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
  }, []);

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
    
    setIsStarting(true);
    const result = await startCheckInSession(event.id, selectedDuration);
    
    if (result.success) {
      setCheckInOpen(true);
      setShowStartModal(false);
      if (selectedDuration > 0) {
        setRemainingTime(selectedDuration * 60);
      } else {
        setRemainingTime(null);
      }
    }
    setIsStarting(false);
  };

  // 结束签到
  const handleEndCheckIn = async () => {
    if (!event) return;
    
    await endCheckInSession(event.id);
    setCheckInOpen(false);
    setRemainingTime(null);
  };

  // 格式化倒计时显示
  const formatRemainingTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // 更新统计数据
  const updateStats = (checkIns: LuckCheckIn[], count: number) => {
    const localStats = calculateStats();
    
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

    const departmentStats = Array.from(deptMap.entries()).map(([department, stats]) => ({
      department,
      total: stats.total,
      checkedIn: stats.checkedIn,
      percentage: 100,
    })).sort((a, b) => b.checkedIn - a.checkedIn);

    setStats({
      totalParticipants: localStats.totalParticipants || 100,
      checkedInCount: count,
      checkInPercentage: Math.round((count / (localStats.totalParticipants || 100)) * 100),
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
    
    const checkIns = await getCheckInRecords(event.id, 50);
    setRecords(checkIns);
    
    const count = await getCheckInCount(event.id);
    // setCheckInCount(count) removed
    
    updateStats(checkIns, count);
  };

  // 复制链接
  const copyUrl = () => {
    navigator.clipboard.writeText(getCheckInUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 全屏切换
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
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
    <div className="relative min-h-screen w-full overflow-hidden font-sans text-white bg-[#0b0a1a]">
      {/* 背景层 */}
      <div className="absolute inset-0 z-0">
        <div 
          className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full mix-blend-screen filter blur-[120px] opacity-30 animate-pulse"
          style={{ backgroundColor: COLORS.primary }}
        />
        <div 
          className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full mix-blend-screen filter blur-[150px] opacity-25 animate-pulse"
          style={{ backgroundColor: COLORS.secondary, animationDelay: '1s' }}
        />
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40vw] h-[40vw] rounded-full mix-blend-screen filter blur-[100px] opacity-20 animate-pulse"
          style={{ backgroundColor: COLORS.success, animationDelay: '2s' }}
        />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-15" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,41,0)_1px,transparent_1px),linear-gradient(90deg,rgba(18,16,41,0)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)]" />
      </div>

      {/* 主内容 */}
      <div className="relative z-10 flex flex-col h-screen p-4 md:p-6 lg:p-8">
        
        {/* 顶部 Header */}
        <header className="flex items-center justify-between mb-6 shrink-0">
          {/* 左侧：返回按钮 + 标题 */}
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <div>
              <h1 className="text-2xl md:text-4xl font-black tracking-wider flex items-center gap-3">
                <Sparkles className="text-yellow-400" size={28} />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-gray-400">
                  {event?.name || settings?.eventName || '年度盛典'}
                </span>
                <span className="text-lg md:text-2xl text-[#b63cfa] font-medium opacity-80">
                  / 签到大屏
                </span>
              </h1>
              <p className="text-gray-500 text-sm mt-1 flex items-center gap-2">
                <MapPin size={12} />
                <span>实时签到动态展示</span>
                <span className="text-green-400">● 已连接数据库</span>
              </p>
            </div>
          </div>

          {/* 右侧：签到状态 + 时间 + 控制按钮 */}
          <div className="flex items-center gap-4">
            {/* 签到状态和倒计时 */}
            {checkInOpen ? (
              <div className="flex items-center gap-3">
                {/* 倒计时显示 */}
                {remainingTime !== null && remainingTime > 0 ? (
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${
                    remainingTime <= 60 
                      ? 'bg-red-500/20 border-red-500/30 text-red-400 animate-pulse' 
                      : remainingTime <= 300 
                        ? 'bg-orange-500/20 border-orange-500/30 text-orange-400'
                        : 'bg-green-500/20 border-green-500/30 text-green-400'
                  }`}>
                    <Timer size={18} />
                    <span className="font-mono text-lg font-bold">
                      {formatRemainingTime(remainingTime)}
                    </span>
                    <span className="text-xs opacity-70">剩余</span>
                  </div>
                ) : remainingTime === null ? (
                  <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 rounded-xl border border-green-500/30 text-green-400">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="font-medium">签到进行中</span>
                  </div>
                ) : null}
                
                {/* 结束签到按钮 */}
                <button
                  onClick={handleEndCheckIn}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-xl border border-red-500/30 text-red-400 transition-all"
                  title="结束签到"
                >
                  <Square size={16} />
                  <span className="hidden md:inline">结束签到</span>
                </button>
              </div>
            ) : (
              /* 签到未开启时显示"开始签到"按钮 */
              <button
                onClick={() => setShowStartModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 rounded-xl text-white font-bold shadow-lg shadow-green-500/30 transition-all hover:scale-105"
                title="开始签到"
              >
                <Play size={18} />
                <span>开始签到</span>
              </button>
            )}
            
            {/* 当前时间 */}
            <div className="hidden md:flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/10">
              <Clock size={16} className="text-blue-400" />
              <span className="font-mono text-lg">
                {currentTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>

            {/* 控制按钮组 */}
            <div className="flex items-center gap-2">
              {/* 刷新按钮 */}
              <button
                onClick={refreshData}
                className="p-2.5 bg-green-500/20 hover:bg-green-500/30 rounded-xl border border-green-500/30 text-green-400 transition-all"
                title="刷新数据"
              >
                <RefreshCw size={18} />
              </button>
              
              {/* 声音开关 */}
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-2.5 rounded-xl border transition-all ${
                  soundEnabled 
                    ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' 
                    : 'bg-white/5 border-white/10 text-gray-500'
                }`}
                title={soundEnabled ? '关闭提示音' : '开启提示音'}
              >
                {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </button>
              
              {/* 二维码显示 */}
              <button
                onClick={() => setShowQRModal(true)}
                className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all"
                title="显示签到二维码"
              >
                <QrCode size={18} />
              </button>
              
              {/* 全屏 */}
              <button
                onClick={toggleFullscreen}
                className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all"
                title="全屏显示"
              >
                <Maximize size={18} />
              </button>
            </div>
          </div>
        </header>

        {/* 主体区域 */}
        <div className="flex-1 flex gap-6 min-h-0">
          
          {/* 左侧：实时动态 */}
          <div className="flex-1 flex flex-col bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6 overflow-hidden">
            <RealtimeFeed 
              records={convertedRecords}
              maxDisplay={settings?.maxDisplayCount || 15}
              animationStyle={settings?.animationStyle || 'slide'}
            />
          </div>

          {/* 右侧：统计 + 最新签到 + 二维码 */}
          <div className="w-96 flex flex-col gap-6 shrink-0">
            
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

            {/* 最新签到展示 - 头像网格 */}
            <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles size={18} className="text-yellow-400" />
                  <h4 className="font-bold text-white">刚刚签到</h4>
                </div>
                {checkInQueue.length > 0 && (
                  <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full animate-pulse">
                    +{checkInQueue.length} 待展示
                  </span>
                )}
              </div>
              
              {/* 最新签到的大卡片 */}
              {latestRecord && (
                <div className={`mb-4 p-4 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-600/10 border border-green-500/30 ${showLatestAnimation ? 'animate-pulse' : ''}`}>
                  <div className="flex items-center gap-4">
                    <img
                      src={latestRecord.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${latestRecord.employee_id}`}
                      alt={latestRecord.name}
                      className={`w-16 h-16 rounded-2xl border-2 border-green-500/60 object-cover ${showLatestAnimation ? 'ring-4 ring-green-500/50 ring-offset-2 ring-offset-transparent' : ''}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-lg font-bold text-white truncate">{latestRecord.name}</p>
                      <p className="text-sm text-green-400">{latestRecord.department || latestRecord.employee_id}</p>
                      {showLatestAnimation && (
                        <p className="text-xs text-yellow-400 mt-1 animate-bounce">{greeting}</p>
                      )}
                    </div>
                    {showLatestAnimation && (
                      <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center animate-bounce">
                        <Check size={20} className="text-white" />
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* 最近签到的头像网格 */}
              {convertedRecords.length > 1 && (
                <div className="grid grid-cols-4 gap-3">
                  {convertedRecords.slice(1, 9).map((record, index) => (
                    <div 
                      key={record.id}
                      className="text-center group"
                      style={{ 
                        animation: `fadeInUp 0.3s ease-out ${index * 50}ms forwards`,
                        opacity: 0 
                      }}
                    >
                      <img
                        src={record.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${record.employeeId}`}
                        alt={record.name}
                        className="w-14 h-14 mx-auto rounded-xl border-2 border-white/20 object-cover group-hover:border-blue-500/50 transition-all group-hover:scale-110"
                      />
                      <p className="text-xs text-gray-400 mt-1 truncate">{record.name}</p>
                    </div>
                  ))}
                </div>
              )}
              
              {convertedRecords.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Users size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">等待签到...</p>
                </div>
              )}
            </div>

            {/* 签到二维码 - 真实二维码 */}
            <div className="relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6 text-center group">
              {/* 放大按钮 - 悬浮在右上角 */}
              <button
                onClick={() => setShowQRModal(true)}
                className="absolute top-3 right-3 p-2 bg-white/10 hover:bg-white/20 rounded-xl border border-white/10 text-gray-400 hover:text-white transition-all opacity-0 group-hover:opacity-100 hover:scale-110"
                title="放大二维码"
              >
                <Maximize size={16} />
              </button>
              
              <div 
                className="w-40 h-40 mx-auto bg-white rounded-2xl p-3 mb-4 shadow-lg cursor-pointer hover:scale-105 transition-transform"
                onClick={() => setShowQRModal(true)}
              >
                <QRCodeSVG 
                  value={getCheckInUrl()}
                  size={136}
                  level="H"
                  includeMargin={false}
                  bgColor="#FFFFFF"
                  fgColor="#000000"
                />
              </div>
              <p className="text-sm text-white font-bold">扫码签到</p>
              <p className="text-xs text-gray-400 mt-1">使用微信扫描二维码</p>
              
              {/* 链接操作 */}
              <div className="mt-3 flex items-center justify-center gap-2">
                <button
                  onClick={copyUrl}
                  className="flex items-center gap-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs text-gray-300 transition-all"
                >
                  {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                  <span>{copied ? '已复制' : '复制链接'}</span>
                </button>
                <a
                  href={getCheckInUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs text-gray-300 transition-all"
                >
                  <ExternalLink size={12} />
                  <span>打开</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 新签到弹出动画 */}
      {showLatestAnimation && latestRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative animate-bounceIn">
            {/* 背景光效 */}
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/30 via-emerald-500/20 to-teal-500/30 blur-3xl scale-150 animate-pulse" />
            
            {/* 卡片 */}
            <div className="relative bg-gradient-to-br from-green-500/20 via-emerald-600/15 to-teal-500/10 backdrop-blur-2xl border-2 border-green-500/40 rounded-[2rem] p-10 shadow-[0_0_80px_rgba(34,197,94,0.4)]">
              {/* 顶部装饰 */}
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full text-sm font-bold shadow-xl">
                <Sparkles size={16} />
                <span>签到成功</span>
              </div>
              
              {/* 头像 */}
              <div className="flex justify-center mb-6 mt-4">
                <div className="relative">
                  <img
                    src={latestRecord.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${latestRecord.employee_id}`}
                    alt={latestRecord.name}
                    className="w-32 h-32 rounded-3xl border-4 border-green-500/60 object-cover shadow-2xl"
                  />
                  <div className="absolute -bottom-3 -right-3 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center shadow-lg animate-bounce">
                    <Users size={20} className="text-white" />
                  </div>
                </div>
              </div>
              
              {/* 信息 */}
              <div className="text-center">
                <h2 className="text-4xl font-black text-white mb-2">{latestRecord.name}</h2>
                <p className="text-xl text-green-400 font-medium">{latestRecord.department || '未知部门'}</p>
                <p className="text-gray-400 mt-2">{latestRecord.employee_id}</p>
                
                {/* 祝福语 */}
                <div className="mt-6 pt-6 border-t border-white/10">
                  <p className="text-2xl text-yellow-400 font-bold animate-pulse">{greeting}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 二维码弹窗 - 极简全屏设计 */}
      {showQRModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center animate-modalFadeIn cursor-pointer"
          onClick={() => setShowQRModal(false)}
        >
          {/* 纯净深色背景 */}
          <div className="absolute inset-0 bg-[#0a0a0f]" />
          
          {/* 微妙的背景光效 */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120vh] h-[120vh] bg-gradient-radial from-blue-900/20 via-purple-900/10 to-transparent rounded-full blur-3xl" />
          </div>
          
          {/* 顶部倒计时显示 */}
          {checkInOpen && remainingTime !== null && remainingTime > 0 && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20">
              <div className={`flex items-center gap-3 px-6 py-3 rounded-2xl border backdrop-blur-xl ${
                remainingTime <= 60 
                  ? 'bg-red-500/30 border-red-500/50 text-red-300 animate-pulse' 
                  : remainingTime <= 300 
                    ? 'bg-orange-500/30 border-orange-500/50 text-orange-300'
                    : 'bg-green-500/30 border-green-500/50 text-green-300'
              }`}>
                <Timer size={24} />
                <span className="font-mono text-2xl font-bold">
                  {formatRemainingTime(remainingTime)}
                </span>
                <span className="text-sm opacity-80">后结束签到</span>
              </div>
            </div>
          )}
          
          {/* 关闭按钮 - 右上角 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowQRModal(false);
            }}
            className="absolute top-6 right-6 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-all duration-200 hover:scale-110 z-10"
          >
            <X size={24} />
          </button>
          
          {/* 二维码容器 - 居中超大显示 */}
          <div 
            className="relative animate-modalSlideUp"
            onClick={e => e.stopPropagation()}
          >
            {/* 外层柔和光晕 */}
            <div className="absolute -inset-12 md:-inset-20 bg-gradient-to-br from-blue-500/20 via-purple-500/15 to-pink-500/10 rounded-[4rem] blur-3xl opacity-70" />
            
            {/* 二维码白色容器 */}
            <div className="relative bg-white rounded-[2rem] md:rounded-[3rem] p-8 md:p-12 shadow-[0_0_150px_rgba(59,130,246,0.25)]">
              <QRCodeSVG 
                value={getCheckInUrl()}
                size={Math.min(window.innerWidth * 0.7, window.innerHeight * 0.6, 560)}
                level="H"
                includeMargin={false}
                bgColor="#FFFFFF"
                fgColor="#000000"
              />
            </div>
          </div>
          
          {/* 底部简洁提示 */}
          <div className="absolute bottom-8 left-0 right-0 text-center">
            <p className="text-gray-500 text-lg">使用微信扫描二维码签到</p>
            <p className="text-gray-600 text-sm mt-2">点击任意位置关闭</p>
          </div>
        </div>
      )}

      {/* 开始签到弹窗 */}
      {showStartModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center animate-modalFadeIn">
          {/* 背景遮罩 */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" />
          
          {/* 弹窗内容 */}
          <div className="relative animate-modalSlideUp max-w-md w-full mx-4">
            {/* 外层光效 */}
            <div className="absolute -inset-1 bg-gradient-to-br from-blue-500/30 via-purple-500/20 to-pink-500/10 rounded-[2.5rem] blur-xl opacity-60" />
            
            {/* 主卡片 */}
            <div className="relative bg-gradient-to-br from-[#1c1c1e] via-[#2c2c2e] to-[#1c1c1e] rounded-[2rem] p-8 border border-white/10 shadow-2xl">
              {/* 图标 */}
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <QrCode size={40} className="text-white" />
                </div>
              </div>
              
              {/* 标题 */}
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">签到管理</h2>
                <p className="text-gray-400">{event?.name || '年度盛典'}</p>
              </div>
              
              {/* 时长选择 */}
              <div className="mb-8">
                <label className="block text-sm text-gray-400 mb-3">选择签到时长</label>
                <div className="grid grid-cols-3 gap-2">
                  {DURATION_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      onClick={() => setSelectedDuration(option.value)}
                      className={`py-3 px-4 rounded-xl text-sm font-medium transition-all ${
                        selectedDuration === option.value
                          ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                          : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
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
                  className="flex-1 py-4 px-6 bg-white/10 hover:bg-white/15 rounded-xl text-white font-medium transition-all border border-white/10"
                >
                  仅查看记录
                </button>
                <button
                  onClick={handleStartCheckIn}
                  disabled={isStarting}
                  className="flex-1 flex items-center justify-center gap-2 py-4 px-6 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 rounded-xl text-white font-bold transition-all shadow-lg shadow-green-500/30 disabled:opacity-50"
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
              <p className="text-center text-gray-500 text-xs mt-6">
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
