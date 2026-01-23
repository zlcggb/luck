import { useState, useEffect, useCallback } from 'react';
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
  X
} from 'lucide-react';
import { CheckInRecord, CheckInSettings } from '../types/checkin';
import { loadCheckInRecords, loadCheckInSettings, calculateStats, addCheckInRecord } from '../utils/checkinStorage';
import CheckInCard from '../components/checkin/CheckInCard';
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

interface CheckInDisplayPageProps {
  onBack?: () => void;
}

/**
 * 签到大屏展示页面
 * 用于现场大屏实时展示签到动态
 */
const CheckInDisplayPage = ({ onBack }: CheckInDisplayPageProps) => {
  // 状态
  const [records, setRecords] = useState<CheckInRecord[]>([]);
  const [settings, setSettings] = useState<CheckInSettings | null>(null);
  const [latestRecord, setLatestRecord] = useState<CheckInRecord | null>(null);
  const [showLatestAnimation, setShowLatestAnimation] = useState(false);
  const [greeting, setGreeting] = useState('');
  const [_isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showQRModal, setShowQRModal] = useState(false);
  const [stats, setStats] = useState({
    totalParticipants: 100,
    checkedInCount: 0,
    checkInPercentage: 0,
    departmentStats: [] as { department: string; total: number; checkedIn: number; percentage: number }[],
    lastCheckInTime: undefined as string | undefined,
  });

  // 初始化加载数据
  useEffect(() => {
    const savedSettings = loadCheckInSettings();
    setSettings(savedSettings);
    
    const savedRecords = loadCheckInRecords();
    // 如果没有保存的记录，使用模拟数据展示效果
    setRecords(savedRecords.length > 0 ? savedRecords : []);
    
    const currentStats = calculateStats();
    setStats(currentStats);
  }, []);

  // 监听存储变化（用于跨标签页同步）
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'checkin_records') {
        const newRecords = loadCheckInRecords();
        
        // 检测新签到
        if (newRecords.length > records.length) {
          const newRecord = newRecords[0];
          handleNewCheckIn(newRecord);
        }
        
        setRecords(newRecords);
        setStats(calculateStats());
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [records]);

  // 处理新签到
  const handleNewCheckIn = useCallback((record: CheckInRecord) => {
    setLatestRecord(record);
    setGreeting(GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);
    setShowLatestAnimation(true);
    
    // 播放提示音
    if (soundEnabled) {
      playCheckInSound();
    }
    
    // 3秒后隐藏动画
    setTimeout(() => {
      setShowLatestAnimation(false);
    }, 5000);
  }, [soundEnabled]);

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

  // 模拟签到（开发测试用）
  const simulateCheckIn = () => {
    const mockNames = ['张伟', '王芳', '李娜', '刘洋', '陈静', '杨帆', '赵敏', '周涛'];
    const mockDepts = ['技术研发中心', '全球市场部', '综合管理部', '财务部', '人力资源部'];
    const randomIdx = Math.floor(Math.random() * 1000);
    
    const newRecord: CheckInRecord = {
      id: `mock_${Date.now()}`,
      eventId: 'event_1',
      employeeId: `EMP${String(randomIdx).padStart(3, '0')}`,
      name: mockNames[randomIdx % mockNames.length] + (randomIdx > 10 ? randomIdx : ''),
      department: mockDepts[randomIdx % mockDepts.length],
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${randomIdx}`,
      checkInTime: new Date().toISOString(),
      checkInMethod: 'qrcode',
      createdAt: new Date().toISOString(),
    };
    
    const updatedRecords = addCheckInRecord(newRecord);
    setRecords(updatedRecords);
    setStats(calculateStats());
    handleNewCheckIn(newRecord);
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
                  {settings?.eventName || '年度盛典'}
                </span>
                <span className="text-lg md:text-2xl text-[#b63cfa] font-medium opacity-80">
                  / 签到大屏
                </span>
              </h1>
              <p className="text-gray-500 text-sm mt-1 flex items-center gap-2">
                <MapPin size={12} />
                <span>实时签到动态展示</span>
              </p>
            </div>
          </div>

          {/* 右侧：时间 + 控制按钮 */}
          <div className="flex items-center gap-4">
            {/* 当前时间 */}
            <div className="hidden md:flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/10">
              <Clock size={16} className="text-blue-400" />
              <span className="font-mono text-lg">
                {currentTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>

            {/* 控制按钮组 */}
            <div className="flex items-center gap-2">
              {/* 模拟签到按钮（开发用） */}
              <button
                onClick={simulateCheckIn}
                className="p-2.5 bg-green-500/20 hover:bg-green-500/30 rounded-xl border border-green-500/30 text-green-400 transition-all"
                title="模拟签到（开发测试）"
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
              records={records}
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

            {/* 最新签到展示 */}
            {records.length > 0 && (
              <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles size={18} className="text-yellow-400" />
                  <h4 className="font-bold text-white">最新签到</h4>
                </div>
                <CheckInCard 
                  record={records[0]}
                  variant="large"
                  showAnimation={false}
                />
              </div>
            )}

            {/* 签到二维码 */}
            {settings?.showQRCode && (
              <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6 text-center">
                <div className="w-32 h-32 mx-auto bg-white rounded-2xl p-3 mb-4">
                  {/* 这里放置实际的二维码，目前用占位符 */}
                  <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
                    <QrCode size={60} className="text-gray-800" />
                  </div>
                </div>
                <p className="text-sm text-gray-400">扫码签到</p>
                <p className="text-xs text-gray-600 mt-1">请使用企业微信扫描</p>
              </div>
            )}
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
                    src={latestRecord.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${latestRecord.employeeId}`}
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
                <p className="text-gray-400 mt-2">{latestRecord.employeeId}</p>
                
                {/* 祝福语 */}
                <div className="mt-6 pt-6 border-t border-white/10">
                  <p className="text-2xl text-yellow-400 font-bold animate-pulse">{greeting}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 二维码弹窗 */}
      {showQRModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setShowQRModal(false)}
        >
          <div 
            className="relative bg-white rounded-3xl p-8 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setShowQRModal(false)}
              className="absolute -top-3 -right-3 w-10 h-10 bg-gray-800 hover:bg-gray-700 rounded-full flex items-center justify-center text-white transition-colors"
            >
              <X size={20} />
            </button>
            
            <div className="w-64 h-64 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mb-4">
              <QrCode size={120} className="text-gray-800" />
            </div>
            
            <p className="text-center text-gray-800 font-bold text-lg">扫码签到</p>
            <p className="text-center text-gray-500 text-sm mt-1">请使用企业微信扫描</p>
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
      `}</style>
    </div>
  );
};

export default CheckInDisplayPage;
