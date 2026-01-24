import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  MapPin, 
  Check, 
  Loader2, 
  AlertCircle, 
  UserCheck,
  Sparkles,
  Building2,
  RefreshCw,
  Search,
  ArrowRight,
  ChevronRight,
  MapPinned,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { 
  LuckEvent,
  LuckCheckIn,
  LuckParticipant,
  checkIn,
  getCheckInByEmployee,
  getActiveEvent,
  getEvent,
  getParticipants,
  isCheckInOpen
} from '../utils/supabaseCheckin';

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

// 页面状态
type PageState = 
  | 'loading'
  | 'closed'          // 签到已关闭
  | 'search'          // 搜索工号
  | 'select'          // 选择匹配结果
  | 'get_location'    // 获取位置
  | 'confirm'         // 确认签到
  | 'checking_in'     // 签到中
  | 'success'         // 签到成功
  | 'already_checked' // 已签到
  | 'error';          // 错误

// 位置信息
interface LocationInfo {
  latitude: number;
  longitude: number;
  accuracy: number;
}

/**
 * 签到页面 - 工号搜索 + 选择 + 定位 + 签到
 * 支持 URL 参数: /checkin?event=活动ID
 */
const CheckInPage = () => {
  // 获取 URL 参数
  const [searchParams] = useSearchParams();
  const eventIdFromUrl = searchParams.get('event');

  // 状态
  const [pageState, setPageState] = useState<PageState>('loading');
  const [event, setEvent] = useState<LuckEvent | null>(null);
  const [selectedParticipant, setSelectedParticipant] = useState<LuckParticipant | null>(null);
  const [searchResults, setSearchResults] = useState<LuckParticipant[]>([]);
  const [allParticipants, setAllParticipants] = useState<LuckParticipant[]>([]);
  const [location, setLocation] = useState<LocationInfo | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [locationError, setLocationError] = useState<string>('');
  const [checkInRecord, setCheckInRecord] = useState<LuckCheckIn | null>(null);
  const [greeting, setGreeting] = useState('');
  const [error, setError] = useState<string>('');

  // 搜索状态
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 初始化 - 获取活动信息和参与者列表
  useEffect(() => {
    const init = async () => {
      // 随机选择祝福语
      setGreeting(GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);
      
      let activeEvent: LuckEvent | null = null;
      
      // 如果 URL 中有活动 ID，优先使用
      if (eventIdFromUrl) {
        activeEvent = await getEvent(eventIdFromUrl);
        if (!activeEvent) {
          setError('无效的活动链接，请确认二维码是否正确');
          setPageState('error');
          return;
        }
      } else {
        // 否则获取当前活跃的活动
        activeEvent = await getActiveEvent();
      }
      
      if (activeEvent) {
        setEvent(activeEvent);
        
        // 检查签到是否开放
        const checkInStatus = await isCheckInOpen(activeEvent.id);
        if (!checkInStatus.open) {
          setError(checkInStatus.message || '签到尚未开始或已结束');
          setPageState('closed');
          return;
        }
        
        // 获取该活动的所有参与者
        const participants = await getParticipants(activeEvent.id);
        setAllParticipants(participants);
        
        if (participants.length === 0) {
          setError('该活动暂无参与者名单，请联系管理员');
          setPageState('error');
          return;
        }
      } else {
        setError('暂无进行中的活动');
        setPageState('error');
        return;
      }
      
      setPageState('search');
    };

    init();
  }, [eventIdFromUrl]);

  // 搜索工号
  const handleSearch = async () => {
    if (!searchQuery.trim() || !event) return;
    
    setIsSearching(true);
    
    try {
      const query = searchQuery.trim().toUpperCase();
      
      // 本地搜索（工号或姓名模糊匹配）
      const results = allParticipants.filter(p => 
        p.employee_id.toUpperCase().includes(query) ||
        p.name.includes(searchQuery.trim())
      );
      
      setSearchResults(results);
      
      if (results.length > 0) {
        setPageState('select');
      } else {
        setSearchResults([]);
      }
    } catch (err) {
      console.error('搜索失败:', err);
    } finally {
      setIsSearching(false);
    }
  };

  // 选择参与者
  const handleSelectParticipant = async (participant: LuckParticipant) => {
    if (!event) return;
    
    // 检查是否已签到
    const existingCheckIn = await getCheckInByEmployee(event.id, participant.employee_id);
    if (existingCheckIn) {
      setCheckInRecord(existingCheckIn);
      setSelectedParticipant(participant);
      setPageState('already_checked');
      return;
    }
    
    setSelectedParticipant(participant);
    
    // 进入定位步骤
    if (event.require_location) {
      setPageState('get_location');
    } else {
      setPageState('confirm');
    }
  };

  // 请求地理位置
  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('您的设备不支持定位功能');
      setLocationStatus('error');
      return;
    }

    setLocationStatus('loading');
    setLocationError('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setLocationStatus('success');
      },
      (error) => {
        let errorMessage = '获取位置失败';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = '您拒绝了位置权限';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = '无法获取当前位置';
            break;
          case error.TIMEOUT:
            errorMessage = '获取位置超时';
            break;
        }
        setLocationError(errorMessage);
        setLocationStatus('error');
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  // 继续到确认页面
  const proceedToConfirm = () => {
    setPageState('confirm');
  };

  // 执行签到（写入数据库）
  const handleCheckIn = async () => {
    if (!selectedParticipant || !event) return;
    
    setPageState('checking_in');
    
    try {
      const result = await checkIn({
        eventId: event.id,
        employeeId: selectedParticipant.employee_id,
        name: selectedParticipant.name,
        department: selectedParticipant.department || undefined,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedParticipant.employee_id}`,
        location: location || undefined,
      });

      if (!result.success) {
        if (result.data) {
          // 已签到
          setCheckInRecord(result.data);
          setPageState('already_checked');
        } else {
          setError(result.error || '签到失败');
          setPageState('error');
        }
        return;
      }

      setCheckInRecord(result.data!);
      setPageState('success');
    } catch (err) {
      setError('签到失败，请重试');
      setPageState('error');
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

  // 返回搜索页
  const backToSearch = () => {
    setPageState('search');
    setSelectedParticipant(null);
    setSearchResults([]);
    setSearchQuery('');
    setLocation(null);
    setLocationStatus('idle');
    setLocationError('');
  };

  // 渲染加载状态
  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-6">
      <Loader2 className="w-16 h-16 text-blue-400 animate-spin mb-6" />
      <p className="text-gray-400 text-lg">正在加载活动信息...</p>
    </div>
  );

  // 渲染搜索页面
  const renderSearch = () => (
    <div className="flex flex-col min-h-screen p-6">
      {/* Logo + 标题 */}
      <div className="text-center pt-8 mb-8">
        <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
          <Sparkles size={40} className="text-white" />
        </div>
        <h1 className="text-3xl font-black text-white mb-2">
          {event?.name || '年度盛典'}
        </h1>
        <p className="text-gray-400">输入工号搜索您的信息</p>
      </div>

      {/* 搜索框 */}
      <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
        <div className="bg-white/5 rounded-3xl p-6 border border-white/10 backdrop-blur-sm">
          {/* 搜索输入 */}
          <div className="relative mb-4">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="请输入您的工号或姓名"
              className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-xl text-white text-lg placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition-all"
              autoComplete="off"
              autoFocus
            />
          </div>

          {/* 搜索按钮 */}
          <button
            onClick={handleSearch}
            disabled={!searchQuery.trim() || isSearching}
            className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl text-white text-lg font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {isSearching ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                <span>搜索中...</span>
              </>
            ) : (
              <>
                <Search size={20} />
                <span>搜索</span>
              </>
            )}
          </button>

          {/* 无结果提示 */}
          {searchResults.length === 0 && searchQuery && !isSearching && pageState === 'search' && (
            <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-400 text-sm text-center">
              未找到匹配的信息，请检查工号或姓名
            </div>
          )}

          <p className="text-gray-500 text-xs text-center mt-4">
            共有 {allParticipants.length} 位参与者
          </p>
        </div>
      </div>
    </div>
  );

  // 渲染选择页面
  const renderSelect = () => (
    <div className="flex flex-col min-h-screen p-6">
      {/* 标题 */}
      <div className="text-center pt-6 mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">选择您的信息</h2>
        <p className="text-gray-400 text-sm">
          找到 {searchResults.length} 个匹配结果
        </p>
      </div>

      {/* 搜索结果列表 */}
      <div className="flex-1 max-w-md mx-auto w-full overflow-y-auto">
        <div className="space-y-3">
          {searchResults.map((participant) => (
            <button
              key={participant.id}
              onClick={() => handleSelectParticipant(participant)}
              className="w-full p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-500/50 rounded-2xl text-left transition-all group"
            >
              <div className="flex items-center gap-4">
                {/* 头像 */}
                <img
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${participant.employee_id}`}
                  alt={participant.name}
                  className="w-14 h-14 rounded-xl bg-gray-700"
                />
                
                {/* 信息 */}
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-bold text-white truncate">{participant.name}</p>
                  <p className="text-sm text-gray-400">{participant.employee_id}</p>
                  {participant.department && (
                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                      <Building2 size={12} />
                      {participant.department}
                    </p>
                  )}
                </div>
                
                {/* 箭头 */}
                <ChevronRight size={20} className="text-gray-500 group-hover:text-blue-400 transition-colors" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 返回按钮 */}
      <div className="shrink-0 mt-4 max-w-md mx-auto w-full">
        <button
          onClick={backToSearch}
          className="w-full py-3 text-gray-400 text-sm hover:text-white transition-colors"
        >
          ← 返回搜索
        </button>
      </div>
    </div>
  );

  // 渲染获取位置页面
  const renderGetLocation = () => (
    <div className="flex flex-col min-h-screen p-6">
      {/* 用户信息 */}
      <div className="text-center pt-8 mb-8">
        <img
          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedParticipant?.employee_id}`}
          alt={selectedParticipant?.name}
          className="w-24 h-24 mx-auto rounded-2xl border-4 border-white/20 mb-4 bg-gray-700"
        />
        <h2 className="text-2xl font-bold text-white">{selectedParticipant?.name}</h2>
        <p className="text-gray-400">{selectedParticipant?.employee_id}</p>
      </div>

      {/* 定位区域 */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full">
        <div className="bg-white/5 rounded-3xl p-8 border border-white/10 backdrop-blur-sm w-full text-center">
          {/* 定位图标 */}
          <div className="relative mb-6">
            <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center ${
              locationStatus === 'loading' ? 'bg-blue-500/20 animate-pulse' :
              locationStatus === 'success' ? 'bg-green-500/20' :
              locationStatus === 'error' ? 'bg-red-500/20' :
              'bg-white/10'
            }`}>
              {locationStatus === 'loading' ? (
                <Loader2 size={48} className="text-blue-400 animate-spin" />
              ) : locationStatus === 'success' ? (
                <CheckCircle2 size={48} className="text-green-400" />
              ) : locationStatus === 'error' ? (
                <XCircle size={48} className="text-red-400" />
              ) : (
                <MapPinned size={48} className="text-gray-400" />
              )}
            </div>
          </div>

          {/* 状态文字 */}
          <h3 className="text-xl font-bold text-white mb-2">
            {locationStatus === 'loading' ? '正在获取位置...' :
             locationStatus === 'success' ? '定位成功！' :
             locationStatus === 'error' ? '定位失败' :
             '需要获取您的位置'}
          </h3>
          
          {locationStatus === 'success' && location && (
            <p className="text-green-400 text-sm mb-4">
              精度: {Math.round(location.accuracy)} 米
            </p>
          )}
          
          {locationStatus === 'error' && (
            <p className="text-red-400 text-sm mb-4">{locationError}</p>
          )}

          {/* 操作按钮 */}
          {locationStatus === 'idle' && (
            <button
              onClick={requestLocation}
              className="w-full py-4 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl text-white text-lg font-bold shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <MapPin size={20} />
              <span>获取我的位置</span>
            </button>
          )}

          {locationStatus === 'loading' && (
            <p className="text-gray-400 text-sm">请在弹出的对话框中允许定位权限</p>
          )}

          {locationStatus === 'success' && (
            <button
              onClick={proceedToConfirm}
              className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl text-white text-lg font-bold shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <ArrowRight size={20} />
              <span>继续签到</span>
            </button>
          )}

          {locationStatus === 'error' && (
            <div className="space-y-3">
              <button
                onClick={requestLocation}
                className="w-full py-3 bg-white/10 border border-white/20 rounded-xl text-white font-medium hover:bg-white/20 transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw size={18} />
                <span>重试</span>
              </button>
              <button
                onClick={proceedToConfirm}
                className="w-full py-3 text-gray-400 text-sm hover:text-white transition-colors"
              >
                跳过定位，继续签到
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 返回按钮 */}
      <div className="shrink-0 mt-4 max-w-md mx-auto w-full">
        <button
          onClick={backToSearch}
          className="w-full py-3 text-gray-400 text-sm hover:text-white transition-colors"
        >
          ← 返回搜索
        </button>
      </div>
    </div>
  );

  // 渲染确认签到页面
  const renderConfirm = () => (
    <div className="flex flex-col min-h-screen p-6">
      <div className="flex-1 flex flex-col items-center justify-center">
        {/* 头像 */}
        <div className="relative mb-6">
          <img
            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedParticipant?.employee_id}`}
            alt={selectedParticipant?.name}
            className="w-32 h-32 rounded-3xl border-4 border-white/20 shadow-2xl object-cover bg-gray-700"
          />
          <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
            <Check size={24} className="text-white" />
          </div>
        </div>

        {/* 用户信息 */}
        <h2 className="text-3xl font-black text-white mb-2">{selectedParticipant?.name}</h2>
        {selectedParticipant?.department && (
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <Building2 size={16} />
            <span>{selectedParticipant.department}</span>
          </div>
        )}
        <p className="text-gray-500">{selectedParticipant?.employee_id}</p>

        {/* 位置信息 */}
        {event?.require_location && (
          <div className="mt-6 px-4 py-3 bg-white/5 rounded-xl border border-white/10">
            <div className="flex items-center gap-2">
              <MapPin size={16} className={location ? 'text-green-400' : 'text-yellow-400'} />
              <span className={location ? 'text-green-400' : 'text-yellow-400'}>
                {location 
                  ? `已获取位置 (精度: ${Math.round(location.accuracy)}米)` 
                  : '未获取位置'
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
      <div className="shrink-0 pb-safe max-w-md mx-auto w-full">
        <button
          onClick={handleCheckIn}
          className="w-full py-5 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl text-white text-xl font-black shadow-xl hover:shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
        >
          <UserCheck size={28} />
          <span>确认签到</span>
        </button>

        <button
          onClick={backToSearch}
          className="w-full mt-3 py-3 text-gray-400 text-sm hover:text-white transition-colors"
        >
          ← 返回搜索
        </button>
      </div>
    </div>
  );

  // 渲染签到中状态
  const renderCheckingIn = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-6">
      <Loader2 className="w-20 h-20 text-green-400 animate-spin mb-6" />
      <h2 className="text-2xl font-bold text-white mb-2">签到中...</h2>
      <p className="text-gray-400">正在保存签到信息</p>
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
        <div className="absolute inset-0 animate-ping-slow">
          <div className="w-full h-full rounded-full border-4 border-green-500/30" />
        </div>
      </div>

      <h2 className="text-4xl font-black text-white mb-4">签到成功！</h2>
      
      <div className="mb-6">
        <p className="text-2xl text-green-400 font-bold">{selectedParticipant?.name}</p>
        <p className="text-gray-400">{selectedParticipant?.department || selectedParticipant?.employee_id}</p>
      </div>

      {checkInRecord && (
        <div className="px-6 py-3 bg-white/5 rounded-xl border border-white/10 mb-8">
          <p className="text-gray-400 text-sm">签到时间</p>
          <p className="text-white font-mono text-lg">{formatTime(checkInRecord.check_in_time)}</p>
        </div>
      )}

      <p className="text-2xl text-yellow-400 font-bold animate-bounce">{greeting}</p>

      <style>{`
        @keyframes ping-slow {
          0% { transform: scale(1); opacity: 1; }
          75%, 100% { transform: scale(1.5); opacity: 0; }
        }
        .animate-ping-slow { animation: ping-slow 1.5s cubic-bezier(0, 0, 0.2, 1) infinite; }
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
          <p className="text-2xl text-blue-400 font-bold">{checkInRecord.name}</p>
          <p className="text-gray-400 mb-2">{checkInRecord.department || checkInRecord.employee_id}</p>
          <p className="text-gray-400 text-sm">签到时间：{formatTime(checkInRecord.check_in_time)}</p>
        </div>
      )}
      
      <p className="text-gray-500 mb-8">无需重复签到，祝您活动愉快！</p>

      <button
        onClick={backToSearch}
        className="px-6 py-3 bg-white/10 rounded-xl text-white border border-white/20 hover:bg-white/20 transition-all"
      >
        返回搜索
      </button>
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
        onClick={backToSearch}
        className="flex items-center gap-2 px-6 py-3 bg-white/10 rounded-xl text-white border border-white/20 hover:bg-white/20 transition-all"
      >
        <RefreshCw size={18} />
        <span>返回重试</span>
      </button>
    </div>
  );

  // 渲染签到已关闭页面
  const renderClosed = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
      {/* 图标 */}
      <div className="relative mb-8">
        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-500/30 to-red-500/30 flex items-center justify-center">
            <AlertCircle size={48} className="text-orange-400" />
          </div>
        </div>
      </div>
      
      {/* 标题 */}
      <h2 className="text-3xl font-black text-white mb-4">签到已结束</h2>
      
      {/* 活动名称 */}
      {event && (
        <div className="mb-6">
          <p className="text-xl text-gray-300">{event.name}</p>
        </div>
      )}
      
      {/* 说明 */}
      <p className="text-gray-400 mb-8 max-w-sm">
        {error || '本次签到已结束，感谢您的参与！'}
      </p>
      
      {/* 装饰 */}
      <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10">
        <div className="w-2 h-2 bg-red-500 rounded-full" />
        <span className="text-gray-500 text-sm">签到通道已关闭</span>
      </div>
    </div>
  );

  // 根据状态渲染
  const renderContent = () => {
    switch (pageState) {
      case 'loading': return renderLoading();
      case 'closed': return renderClosed();
      case 'search': return renderSearch();
      case 'select': return renderSelect();
      case 'get_location': return renderGetLocation();
      case 'confirm': return renderConfirm();
      case 'checking_in': return renderCheckingIn();
      case 'success': return renderSuccess();
      case 'already_checked': return renderAlreadyChecked();
      case 'error': return renderError();
      default: return renderLoading();
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
