import { useState, useEffect } from 'react';
import { 
  QrCode, 
  MapPin, 
  Check, 
  Loader2, 
  AlertCircle, 
  UserCheck,
  Sparkles,
  Building2,
  Shield,
  RefreshCw
} from 'lucide-react';
import { 
  CheckInRecord, 
  CheckInPageState, 
  WeComUserInfo, 
  LocationInfo,
  CheckInSettings 
} from '../types/checkin';
import { 
  addCheckInRecord, 
  isAlreadyCheckedIn, 
  getCheckInRecord,
  loadCheckInSettings 
} from '../utils/checkinStorage';

// 配置色系
const COLORS = {
  primary: '#3c80fa',
  secondary: '#573cfa',
  accent: '#b63cfa',
  success: '#22c55e',
  dark: '#0f0c29',
};

// 祝福语
const GREETINGS = [
  '欢迎参加年度盛典！🎉',
  '祝您好运连连！🍀',
  '愿您今晚满载而归！🎁',
  '开启幸运之旅！✨',
];

/**
 * 移动端签到页面
 * 支持企业微信扫码授权 + 地理位置获取 + 签到
 */
const CheckInPage = () => {
  // 状态
  const [pageState, setPageState] = useState<CheckInPageState>('loading');
  const [userInfo, setUserInfo] = useState<WeComUserInfo | null>(null);
  const [location, setLocation] = useState<LocationInfo | null>(null);
  const [locationError, setLocationError] = useState<string>('');
  const [settings, setSettings] = useState<CheckInSettings | null>(null);
  const [checkInRecord, setCheckInRecord] = useState<CheckInRecord | null>(null);
  const [greeting, setGreeting] = useState('');
  const [error, setError] = useState<string>('');

  // 初始化
  useEffect(() => {
    const savedSettings = loadCheckInSettings();
    setSettings(savedSettings);
    
    // 随机选择祝福语
    setGreeting(GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);
    
    // 检查是否有 OAuth 回调参数
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    
    if (code && state) {
      // 有 OAuth 回调，处理授权
      handleOAuthCallback(code, state);
    } else {
      // 检测运行环境
      detectEnvironment();
    }
  }, []);

  // 检测运行环境
  const detectEnvironment = () => {
    const ua = navigator.userAgent.toLowerCase();
    const isWeCom = ua.includes('wxwork') || ua.includes('wechat');
    
    if (isWeCom) {
      // 在企业微信内，自动发起授权
      // 实际项目中这里会跳转到企业微信授权页面
      setPageState('show_qrcode'); // 暂时显示模拟界面
    } else {
      // 不在企业微信内，显示二维码
      setPageState('show_qrcode');
    }
  };

  // 处理 OAuth 回调
  const handleOAuthCallback = async (_code: string, _state: string) => {
    setPageState('authorizing');
    
    try {
      // 实际项目中，这里会调用后端 API 获取用户信息
      // const response = await fetch('/api/wecom/user-info', {
      //   method: 'POST',
      //   body: JSON.stringify({ code, state })
      // });
      // const data = await response.json();
      
      // 模拟获取用户信息
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const mockUserInfo: WeComUserInfo = {
        employeeId: 'EMP' + String(Math.floor(Math.random() * 1000)).padStart(3, '0'),
        name: '张三',
        department: '技术研发中心',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=123',
      };
      
      setUserInfo(mockUserInfo);
      
      // 检查是否已签到
      if (isAlreadyCheckedIn(mockUserInfo.employeeId)) {
        const existingRecord = getCheckInRecord(mockUserInfo.employeeId);
        if (existingRecord) {
          setCheckInRecord(existingRecord);
        }
        setPageState('already_checked');
        return;
      }
      
      // 检查是否需要定位
      if (settings?.requireLocation) {
        setPageState('get_location');
        requestLocation();
      } else {
        setPageState('confirm');
      }
    } catch (err) {
      setError('获取用户信息失败，请重试');
      setPageState('auth_failed');
    }
  };

  // 请求地理位置
  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('您的设备不支持定位功能');
      setPageState('confirm');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        });
        setPageState('confirm');
      },
      (error) => {
        let errorMessage = '获取位置失败';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = '您拒绝了位置权限，无法获取定位';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = '无法获取当前位置';
            break;
          case error.TIMEOUT:
            errorMessage = '获取位置超时';
            break;
        }
        setLocationError(errorMessage);
        setPageState('confirm');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  // 执行签到
  const handleCheckIn = async () => {
    if (!userInfo) return;
    
    setPageState('checking_in');
    
    try {
      // 模拟签到请求延迟
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 创建签到记录
      const record: CheckInRecord = {
        id: `checkin_${Date.now()}`,
        eventId: 'event_1',
        employeeId: userInfo.employeeId,
        name: userInfo.name,
        department: userInfo.department,
        avatar: userInfo.avatar,
        checkInTime: new Date().toISOString(),
        locationLat: location?.latitude,
        locationLng: location?.longitude,
        locationAccuracy: location?.accuracy,
        locationValid: location ? validateLocation(location) : undefined,
        checkInMethod: 'qrcode',
        createdAt: new Date().toISOString(),
      };
      
      // 保存签到记录
      addCheckInRecord(record);
      setCheckInRecord(record);
      setPageState('success');
    } catch (err) {
      setError('签到失败，请重试');
      setPageState('error');
    }
  };

  // 验证位置是否在有效范围内
  const validateLocation = (loc: LocationInfo): boolean => {
    if (!settings?.locationLat || !settings?.locationLng) {
      return true; // 没有设置目标位置，默认有效
    }
    
    const distance = calculateDistance(
      loc.latitude,
      loc.longitude,
      settings.locationLat,
      settings.locationLng
    );
    
    return distance <= (settings.locationRadius || 500);
  };

  // 计算两点之间的距离（米）
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000; // 地球半径（米）
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  // 模拟扫码登录（开发测试用）
  const simulateLogin = () => {
    const mockUserInfo: WeComUserInfo = {
      employeeId: 'EMP' + String(Math.floor(Math.random() * 1000)).padStart(3, '0'),
      name: ['张伟', '王芳', '李娜', '刘洋', '陈静'][Math.floor(Math.random() * 5)],
      department: ['技术研发中心', '全球市场部', '综合管理部'][Math.floor(Math.random() * 3)],
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random()}`,
    };
    
    setUserInfo(mockUserInfo);
    
    // 检查是否已签到
    if (isAlreadyCheckedIn(mockUserInfo.employeeId)) {
      const existingRecord = getCheckInRecord(mockUserInfo.employeeId);
      if (existingRecord) {
        setCheckInRecord(existingRecord);
      }
      setPageState('already_checked');
      return;
    }
    
    if (settings?.requireLocation) {
      setPageState('get_location');
      requestLocation();
    } else {
      setPageState('confirm');
    }
  };

  // 格式化时间
  const formatTime = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // 渲染加载状态
  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-6">
      <Loader2 className="w-16 h-16 text-blue-400 animate-spin mb-6" />
      <p className="text-gray-400 text-lg">正在初始化...</p>
    </div>
  );

  // 渲染二维码页面（非企业微信环境）
  const renderQRCode = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-6">
      {/* Logo + 标题 */}
      <div className="text-center mb-8">
        <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
          <Sparkles size={40} className="text-white" />
        </div>
        <h1 className="text-3xl font-black text-white mb-2">
          {settings?.eventName || '年度盛典'}
        </h1>
        <p className="text-gray-400">企业微信扫码签到</p>
      </div>

      {/* 二维码区域 */}
      <div className="relative bg-white rounded-3xl p-6 shadow-2xl mb-8">
        <div className="w-56 h-56 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center">
          <QrCode size={120} className="text-gray-800" />
        </div>
        
        {/* 扫描动画线 */}
        <div className="absolute inset-x-6 top-6 bottom-6 overflow-hidden rounded-2xl pointer-events-none">
          <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-green-500 to-transparent animate-scan" />
        </div>
      </div>

      <p className="text-gray-500 text-center mb-6">
        请使用<span className="text-blue-400 font-bold">企业微信</span>扫描上方二维码
      </p>

      {/* 开发测试按钮 */}
      <button
        onClick={simulateLogin}
        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl text-white font-bold shadow-lg hover:shadow-xl transition-all hover:scale-105"
      >
        <UserCheck size={20} />
        <span>模拟登录（测试用）</span>
      </button>

      <style>{`
        @keyframes scan {
          0% { top: 0; }
          50% { top: calc(100% - 4px); }
          100% { top: 0; }
        }
        .animate-scan {
          animation: scan 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );

  // 渲染授权中状态
  const renderAuthorizing = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-6">
      <div className="relative mb-8">
        <div className="w-24 h-24 rounded-full bg-blue-500/20 flex items-center justify-center">
          <Shield size={48} className="text-blue-400" />
        </div>
        <Loader2 className="absolute -top-2 -right-2 w-8 h-8 text-green-400 animate-spin" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">正在验证身份...</h2>
      <p className="text-gray-400">请稍候，正在获取您的企业微信信息</p>
    </div>
  );

  // 渲染获取位置状态
  const renderGetLocation = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-6">
      <div className="relative mb-8">
        <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center animate-pulse">
          <MapPin size={48} className="text-green-400" />
        </div>
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">正在获取位置...</h2>
      <p className="text-gray-400 text-center">
        请允许位置权限以完成签到
      </p>
    </div>
  );

  // 渲染确认签到页面
  const renderConfirm = () => (
    <div className="flex flex-col min-h-screen p-6">
      {/* 用户信息卡片 */}
      <div className="flex-1 flex flex-col items-center justify-center">
        {/* 头像 */}
        <div className="relative mb-6">
          <img
            src={userInfo?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userInfo?.employeeId}`}
            alt={userInfo?.name}
            className="w-32 h-32 rounded-3xl border-4 border-white/20 shadow-2xl object-cover"
          />
          <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
            <Check size={24} className="text-white" />
          </div>
        </div>

        {/* 用户信息 */}
        <h2 className="text-3xl font-black text-white mb-2">{userInfo?.name}</h2>
        <div className="flex items-center gap-2 text-gray-400 mb-1">
          <Building2 size={16} />
          <span>{userInfo?.department || '未知部门'}</span>
        </div>
        <p className="text-gray-500">{userInfo?.employeeId}</p>

        {/* 位置信息 */}
        {settings?.requireLocation && (
          <div className="mt-6 px-4 py-3 bg-white/5 rounded-xl border border-white/10">
            <div className="flex items-center gap-2">
              <MapPin size={16} className={location ? 'text-green-400' : 'text-yellow-400'} />
              <span className={location ? 'text-green-400' : 'text-yellow-400'}>
                {location 
                  ? `已获取位置 (精度: ${Math.round(location.accuracy)}米)` 
                  : locationError || '未获取位置'
                }
              </span>
            </div>
          </div>
        )}

        {/* 祝福语 */}
        <div className="mt-8 text-center">
          <p className="text-xl text-yellow-400 font-bold">{greeting}</p>
        </div>
      </div>

      {/* 签到按钮 */}
      <div className="shrink-0 pb-safe">
        <button
          onClick={handleCheckIn}
          className="w-full py-5 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl text-white text-xl font-black shadow-xl hover:shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
        >
          <UserCheck size={28} />
          <span>确认签到</span>
        </button>
      </div>
    </div>
  );

  // 渲染签到中状态
  const renderCheckingIn = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-6">
      <Loader2 className="w-20 h-20 text-green-400 animate-spin mb-6" />
      <h2 className="text-2xl font-bold text-white mb-2">签到中...</h2>
      <p className="text-gray-400">请稍候</p>
    </div>
  );

  // 渲染签到成功页面
  const renderSuccess = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
      {/* 成功动画 */}
      <div className="relative mb-8">
        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-green-500/30 to-emerald-600/20 flex items-center justify-center animate-pulse">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
            <Check size={48} className="text-white" />
          </div>
        </div>
        {/* 光效 */}
        <div className="absolute inset-0 animate-ping-slow">
          <div className="w-full h-full rounded-full border-4 border-green-500/30" />
        </div>
      </div>

      <h2 className="text-4xl font-black text-white mb-4">签到成功！</h2>
      
      {/* 用户信息 */}
      <div className="mb-6">
        <p className="text-2xl text-green-400 font-bold">{userInfo?.name}</p>
        <p className="text-gray-400">{userInfo?.department}</p>
      </div>

      {/* 签到时间 */}
      {checkInRecord && (
        <div className="px-6 py-3 bg-white/5 rounded-xl border border-white/10 mb-8">
          <p className="text-gray-400 text-sm">签到时间</p>
          <p className="text-white font-mono text-lg">{formatTime(checkInRecord.checkInTime)}</p>
        </div>
      )}

      {/* 祝福语 */}
      <p className="text-2xl text-yellow-400 font-bold animate-bounce">{greeting}</p>

      <style>{`
        @keyframes ping-slow {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          75%, 100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }
        .animate-ping-slow {
          animation: ping-slow 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
      `}</style>
    </div>
  );

  // 渲染已签到页面
  const renderAlreadyChecked = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
      <div className="w-24 h-24 rounded-full bg-blue-500/20 flex items-center justify-center mb-6">
        <UserCheck size={48} className="text-blue-400" />
      </div>
      
      <h2 className="text-3xl font-black text-white mb-4">您已签到</h2>
      
      {checkInRecord && (
        <div className="mb-6">
          <p className="text-gray-400 mb-1">签到时间</p>
          <p className="text-white font-mono text-lg">{formatTime(checkInRecord.checkInTime)}</p>
        </div>
      )}
      
      <p className="text-gray-500">无需重复签到，祝您活动愉快！</p>
    </div>
  );

  // 渲染错误页面
  const renderError = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
      <div className="w-24 h-24 rounded-full bg-red-500/20 flex items-center justify-center mb-6">
        <AlertCircle size={48} className="text-red-400" />
      </div>
      
      <h2 className="text-2xl font-bold text-white mb-2">出错了</h2>
      <p className="text-gray-400 mb-6">{error}</p>
      
      <button
        onClick={() => {
          setError('');
          setPageState('show_qrcode');
        }}
        className="flex items-center gap-2 px-6 py-3 bg-white/10 rounded-xl text-white border border-white/20"
      >
        <RefreshCw size={18} />
        <span>重试</span>
      </button>
    </div>
  );

  // 根据状态渲染不同页面
  const renderContent = () => {
    switch (pageState) {
      case 'loading':
        return renderLoading();
      case 'show_qrcode':
        return renderQRCode();
      case 'authorizing':
        return renderAuthorizing();
      case 'get_location':
        return renderGetLocation();
      case 'confirm':
        return renderConfirm();
      case 'checking_in':
        return renderCheckingIn();
      case 'success':
        return renderSuccess();
      case 'already_checked':
        return renderAlreadyChecked();
      case 'auth_failed':
      case 'error':
        return renderError();
      default:
        return renderLoading();
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden font-sans text-white bg-[#0b0a1a]">
      {/* 背景层 */}
      <div className="absolute inset-0 z-0">
        <div 
          className="absolute top-[-20%] left-[-20%] w-[60vw] h-[60vw] rounded-full mix-blend-screen filter blur-[100px] opacity-30"
          style={{ backgroundColor: COLORS.primary }}
        />
        <div 
          className="absolute bottom-[-20%] right-[-20%] w-[70vw] h-[70vw] rounded-full mix-blend-screen filter blur-[120px] opacity-25"
          style={{ backgroundColor: COLORS.secondary }}
        />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-15" />
      </div>

      {/* 主内容 */}
      <div className="relative z-10">
        {renderContent()}
      </div>
    </div>
  );
};

export default CheckInPage;
