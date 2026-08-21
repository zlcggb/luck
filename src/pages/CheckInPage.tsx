import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Loader2, 
  Check,
  AlertCircle,
  Sparkles,
  ArrowRight,
  MapPinned,
  CheckCircle2,
  XCircle,
  Phone,
  User,
  Building2,
  BadgeCheck,
  Hash
} from 'lucide-react';
import { 
  LuckEvent,
  LuckCheckIn,
  checkIn,
  getActiveEvent,
  getEvent,
  isCheckInOpen
} from '../utils/supabaseCheckin';

// 页面状态
type PageState = 
  | 'loading'
  | 'closed'
  | 'form'           // 转盘式：填写表单
  | 'rolling_search'  // 轮动式：填写姓名+工号签到
  | 'get_location'
  | 'checking_in'
  | 'success'
  | 'already_checked'
  | 'error';

interface LocationInfo {
  latitude: number;
  longitude: number;
  accuracy: number;
}

const CheckInPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const eventIdFromUrl = searchParams.get('event');

  const [pageState, setPageState] = useState<PageState>('loading');
  const [event, setEvent] = useState<LuckEvent | null>(null);
  const [location, setLocation] = useState<LocationInfo | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [locationError, setLocationError] = useState<string>('');
  const [checkInRecord, setCheckInRecord] = useState<LuckCheckIn | null>(null);
  const [error, setError] = useState<string>('');

  // 转盘式表单状态
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    company: ''
  });

  // 轮动式状态
  const [employeeId, setEmployeeId] = useState('');
  const [rollingName, setRollingName] = useState('');
  const [searchError, setSearchError] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRedirectTimer = () => {
    if (redirectTimerRef.current) {
      clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = null;
    }
  };

  const goToPersonalWheel = (phone?: string, record?: LuckCheckIn | null) => {
    if (!event) return;
    const id = phone || record?.employee_id;
    if (!id) return;
    if (record?.id) {
      sessionStorage.setItem(`luck_checkin_token_${event.id}`, record.id);
    }
    const eventQuery = `event=${encodeURIComponent(event.id)}`;
    navigate(`/lottery/personal-wheel?${eventQuery}`);
  };

  useEffect(() => {
    const init = async () => {
      let activeEvent: LuckEvent | null = null;
      
      if (eventIdFromUrl) {
        activeEvent = await getEvent(eventIdFromUrl);
        if (!activeEvent) {
          setError('活动不存在或已过期');
          setPageState('error');
          return;
        }
      } else {
        activeEvent = await getActiveEvent();
      }
      
      if (activeEvent) {
        setEvent(activeEvent);
        const checkInStatus = await isCheckInOpen(activeEvent.id);
        if (!checkInStatus.open) {
          setError(checkInStatus.message || '签到通道未开启');
          setPageState('closed');
          return;
        }
      } else {
        setError('暂无进行中的展会活动');
        setPageState('error');
        return;
      }
      
      // 根据活动模式决定初始页面
      if (activeEvent.mode === 'rolling') {
        setPageState('rolling_search');
      } else {
        setPageState('form');
      }
    };

    init();

    return () => {
      clearRedirectTimer();
    };
  }, [eventIdFromUrl]);

  useEffect(() => {
    if ((pageState === 'success' || pageState === 'already_checked') && checkInRecord) {
      clearRedirectTimer();
      // 轮动式不自动跳转转盘页
      if (event?.mode !== 'rolling') {
        redirectTimerRef.current = setTimeout(() => {
          goToPersonalWheel(formData.phone, checkInRecord);
        }, 1500);
      }
    }
  }, [checkInRecord, pageState, formData.phone]);

  // ============================================
  // 转盘式：表单验证和提交
  // ============================================

  const validateForm = () => {
    if (!formData.name.trim()) return '请输入您的姓名';
    if (!/^1[3-9]\d{9}$/.test(formData.phone.trim())) return '请输入有效的手机号码';
    if (!formData.company.trim()) return '请输入您的所属公司/组织';
    return null;
  };

  const handleSubmitForm = async () => {
    const validationError = validateForm();
    if (validationError) {
      alert(validationError);
      return;
    }

    if (!event) return;

    setIsSubmitting(true);
    try {
      if (event.require_location) {
        setPageState('get_location');
      } else {
        handleCheckIn();
      }
    } catch (err) {
      console.error(err);
      setError('操作失败，请重试');
      setPageState('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================
  // 轮动式：填写姓名+工号直接签到
  // ============================================

  const handleRollingSubmit = async () => {
    if (!event) return;
    const trimmedId = employeeId.trim().toUpperCase();
    const trimmedName = rollingName.trim();

    if (!trimmedName) { setSearchError('请输入您的姓名'); return; }
    if (!trimmedId) { setSearchError('请输入您的工号'); return; }

    setIsSearching(true);
    setSearchError('');

    try {
      // 需要位置验证则先获取位置
      if (event.require_location) {
        setPageState('get_location');
        return;
      }

      // 直接签到（checkIn 内部会自动同步到 luck_participants）
      setPageState('checking_in');
      const result = await checkIn({
        eventId: event.id,
        employeeId: trimmedId,
        name: trimmedName,
        location: location || undefined,
      });

      if (!result.success) {
        if (result.data) {
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
      console.error(err);
      setError('签到失败，请重试');
      setPageState('error');
    } finally {
      setIsSearching(false);
    }
  };

  // 轮动式位置验证后的签到回调
  const handleRollingCheckInAfterLocation = async () => {
    if (!event) return;
    setPageState('checking_in');
    try {
      const result = await checkIn({
        eventId: event.id,
        employeeId: employeeId.trim().toUpperCase(),
        name: rollingName.trim(),
        location: location || undefined,
      });
      if (!result.success) {
        if (result.data) { setCheckInRecord(result.data); setPageState('already_checked'); }
        else { setError(result.error || '签到失败'); setPageState('error'); }
        return;
      }
      setCheckInRecord(result.data!);
      setPageState('success');
    } catch (err) {
      setError('签到失败，请重试');
      setPageState('error');
    }
  };

  // ============================================
  // 通用：定位和签到
  // ============================================

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('当前设备不支持定位功能');
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
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const handleCheckIn = async () => {
    if (!event) return;
    
    setPageState('checking_in');
    
    try {
      const result = await checkIn({
        eventId: event.id,
        employeeId: formData.phone,
        name: formData.name,
        department: formData.company,
        location: location || undefined,
      });

      if (!result.success) {
        if (result.data) {
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
      setError('提交失败，请重试');
      setPageState('error');
    }
  };


  // ============================================
  // Render Functions
  // ============================================

  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-6">
      <Loader2 className="w-12 h-12 text-blue-400 animate-spin mb-4" />
      <p className="text-white/60 text-sm">正在加载活动信息...</p>
    </div>
  );

  // --- 转盘式表单 ---
  const renderForm = () => (
    <div className="flex flex-col min-h-screen p-6 max-w-lg mx-auto w-full animate-fade-in">
      <div className="text-center pt-10 mb-10">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/10 flex items-center justify-center shadow-[0_4px_30px_rgba(0,0,0,0.1)] border border-white/20 backdrop-blur-md">
          <Sparkles size={32} className="text-white" />
        </div>
        <h1 className="large-title-emphasized text-white mb-2 tracking-tight">
          {event?.name || '展会签到'}
        </h1>
        <p className="text-white/60">完善信息，即获专属抽奖机会</p>
      </div>

      <div className="flex-1 flex flex-col gap-6">
        <div className="apple-glass rounded-3xl p-6 sm:p-8 flex flex-col gap-5">
          {/* Name */}
          <div className="group">
            <label className="block text-white/50 text-xs font-semibold uppercase tracking-wider mb-2 pl-1">姓名</label>
            <div className="relative">
              <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="请输入您的姓名"
                className="w-full pl-11 pr-4 py-4 bg-black/20 border border-white/10 rounded-2xl text-white text-[17px] placeholder-white/30 focus:outline-none focus:border-blue-400/50 focus:bg-black/40 transition-all font-medium"
              />
            </div>
          </div>

          {/* Phone */}
          <div className="group">
            <label className="block text-white/50 text-xs font-semibold uppercase tracking-wider mb-2 pl-1">手机号码</label>
            <div className="relative">
              <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="请输入您的手机号"
                maxLength={11}
                className="w-full pl-11 pr-4 py-4 bg-black/20 border border-white/10 rounded-2xl text-white text-[17px] placeholder-white/30 focus:outline-none focus:border-blue-400/50 focus:bg-black/40 transition-all font-medium"
              />
            </div>
          </div>

          {/* Company */}
          <div className="group">
            <label className="block text-white/50 text-xs font-semibold uppercase tracking-wider mb-2 pl-1">公司或组织</label>
            <div className="relative">
              <Building2 size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                placeholder="请输入您的所属公司/组织"
                className="w-full pl-11 pr-4 py-4 bg-black/20 border border-white/10 rounded-2xl text-white text-[17px] placeholder-white/30 focus:outline-none focus:border-blue-400/50 focus:bg-black/40 transition-all font-medium"
                onKeyDown={(e) => e.key === 'Enter' && handleSubmitForm()}
              />
            </div>
          </div>
        </div>
        
        <button
          onClick={handleSubmitForm}
          disabled={isSubmitting || !formData.name || !formData.phone || !formData.company}
          className="w-full py-4 bg-white text-black rounded-2xl text-[17px] font-bold shadow-[0_0_20px_rgba(255,255,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
        >
          {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : '确认并参与抽奖'}
        </button>
      </div>
    </div>
  );

  // --- 轮动式：填写姓名+工号签到 ---
  const renderRollingSearch = () => (
    <div className="flex flex-col min-h-screen p-6 max-w-lg mx-auto w-full animate-fade-in">
      <div className="text-center pt-10 mb-10">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500/30 to-blue-500/30 flex items-center justify-center shadow-[0_4px_30px_rgba(0,0,0,0.1)] border border-white/20 backdrop-blur-md">
          <BadgeCheck size={32} className="text-white" />
        </div>
        <h1 className="large-title-emphasized text-white mb-2 tracking-tight">
          {event?.name || '签到'}
        </h1>
        <p className="text-white/60">填写信息完成签到，参与抽奖</p>
      </div>

      <div className="flex-1 flex flex-col gap-6">
        <div className="apple-glass rounded-3xl p-6 sm:p-8 flex flex-col gap-5">
          {/* 姓名 */}
          <div className="group">
            <label className="block text-white/50 text-xs font-semibold uppercase tracking-wider mb-2 pl-1">姓名</label>
            <div className="relative">
              <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={rollingName}
                onChange={(e) => { setRollingName(e.target.value); setSearchError(''); }}
                placeholder="请输入您的姓名"
                className="w-full pl-11 pr-4 py-4 bg-black/20 border border-white/10 rounded-2xl text-white text-[17px] placeholder-white/30 focus:outline-none focus:border-blue-400/50 focus:bg-black/40 transition-all font-medium"
                autoFocus
              />
            </div>
          </div>
          {/* 工号 */}
          <div className="group">
            <label className="block text-white/50 text-xs font-semibold uppercase tracking-wider mb-2 pl-1">工号</label>
            <div className="relative">
              <Hash size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={employeeId}
                onChange={(e) => { setEmployeeId(e.target.value.toUpperCase()); setSearchError(''); }}
                placeholder="请输入您的工号"
                className="w-full pl-11 pr-4 py-4 bg-black/20 border border-white/10 rounded-2xl text-white text-[17px] placeholder-white/30 focus:outline-none focus:border-blue-400/50 focus:bg-black/40 transition-all font-medium tracking-wider"
                onKeyDown={(e) => e.key === 'Enter' && handleRollingSubmit()}
              />
            </div>
          </div>
          {searchError && (
            <p className="text-red-400 text-sm flex items-center gap-1.5 pl-1">
              <AlertCircle size={14} />
              {searchError}
            </p>
          )}
        </div>
        
        <button
          onClick={handleRollingSubmit}
          disabled={isSearching || !employeeId.trim() || !rollingName.trim()}
          className="w-full py-4 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-2xl text-[17px] font-bold shadow-[0_0_30px_rgba(139,92,246,0.3)] disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[0_0_40px_rgba(139,92,246,0.5)] transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
        >
          {isSearching ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <>
              <CheckCircle2 size={20} />
              签到
            </>
          )}
        </button>
      </div>
    </div>
  );

  const renderGetLocation = () => (
    <div className="flex flex-col min-h-screen p-6 max-w-lg mx-auto w-full animate-fade-in">
      <div className="text-center pt-10 mb-10">
        <h2 className="large-title-emphasized text-white">区域验证</h2>
        <p className="text-white/60 mt-2">本次活动需要验证您的现场位置</p>
      </div>

      <div className="apple-glass rounded-3xl p-8 text-center flex-1 flex flex-col justify-center">
        <div className="relative mb-8">
          <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center transition-colors ${
            locationStatus === 'loading' ? 'bg-blue-500/20' :
            locationStatus === 'success' ? 'bg-green-500/20' :
            locationStatus === 'error' ? 'bg-red-500/20' :
            'bg-white/10'
          }`}>
            {locationStatus === 'loading' ? (
              <Loader2 size={40} className="text-blue-400 animate-spin" />
            ) : locationStatus === 'success' ? (
              <CheckCircle2 size={40} className="text-green-400" />
            ) : locationStatus === 'error' ? (
              <XCircle size={40} className="text-red-400" />
            ) : (
              <MapPinned size={40} className="text-white/80" />
            )}
          </div>
        </div>

        <h3 className="text-xl font-bold text-white mb-2">
          {locationStatus === 'loading' ? '验证中...' :
           locationStatus === 'success' ? '验证成功！' :
           locationStatus === 'error' ? '定位失败' :
           '请允许获取定位权限'}
        </h3>
        
        {locationStatus === 'success' && location && (
          <p className="text-green-400 text-sm mb-6">已获取您的位置 (精度: {Math.round(location.accuracy)}米)</p>
        )}
        
        {locationStatus === 'error' && (
          <p className="text-red-400 text-sm mb-6">{locationError}</p>
        )}

        {locationStatus === 'idle' && (
          <button
            onClick={requestLocation}
            className="w-full py-4 bg-white text-black rounded-2xl font-bold transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            获取定位并继续
          </button>
        )}

        {locationStatus === 'success' && (
          <button
            onClick={() => {
              // 根据模式决定签到方式
              if (event?.mode === 'rolling') {
                handleRollingCheckInAfterLocation();
              } else {
                handleCheckIn();
              }
            }}
            className="w-full py-4 bg-white text-black rounded-2xl font-bold transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
          >
            完成签到 <ArrowRight size={18} />
          </button>
        )}

        {locationStatus === 'error' && (
          <div className="space-y-4">
            <button
              onClick={requestLocation}
              className="w-full py-4 bg-white/10 text-white border border-white/20 rounded-2xl font-bold transition-all hover:bg-white/20"
            >
              重试获取定位
            </button>
            <button
              onClick={() => {
                if (event?.mode === 'rolling') {
                  handleRollingCheckInAfterLocation();
                } else {
                  handleCheckIn();
                }
              }}
              className="w-full py-4 text-white/50 text-sm font-medium hover:text-white transition-colors"
            >
              忽略位置，直接签到
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderCheckingIn = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center animate-fade-in">
      <Loader2 className="w-16 h-16 text-white animate-spin mb-6" />
      <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">处理中...</h2>
      <p className="text-white/50">
        {event?.mode === 'rolling' ? '正在完成签到' : '正在为您生成抽奖机会'}
      </p>
    </div>
  );

  const renderSuccess = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center animate-fade-in max-w-lg mx-auto w-full">
      <div className="w-24 h-24 rounded-full bg-green-500 flex items-center justify-center mb-8 shadow-[0_0_40px_rgba(34,197,94,0.4)]">
        <Check size={48} className="text-white" />
      </div>
      
      <h2 className="large-title-emphasized text-white mb-4">
        {event?.mode === 'rolling' ? '签到成功' : '登记成功'}
      </h2>
      
      <div className="apple-glass rounded-3xl p-6 w-full mb-8">
        {event?.mode === 'rolling' ? (
          <>
            <p className="text-lg text-white font-medium mb-1">{rollingName || checkInRecord?.name}</p>
            <p className="text-white/60 text-sm">
              {employeeId || checkInRecord?.employee_id}
            </p>
            <p className="text-green-400 text-sm mt-3 font-medium">✨ 您已获得抽奖资格</p>
          </>
        ) : (
          <>
            <p className="text-lg text-white font-medium mb-1">{formData.name}</p>
            <p className="text-white/60 text-sm">{formData.company} | {formData.phone}</p>
          </>
        )}
      </div>

      {event?.mode === 'rolling' ? (
        <p className="text-white/60 text-sm">请留意大屏幕，开奖即将开始 🎉</p>
      ) : (
        <>
          <p className="text-white/80 animate-pulse text-[17px]">即将进入抽奖活动...</p>
          <button
            onClick={() => goToPersonalWheel(formData.phone, checkInRecord)}
            className="mt-6 px-6 py-3 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 transition-all text-sm font-medium"
          >
            立即跳转
          </button>
        </>
      )}
    </div>
  );

  const renderAlreadyChecked = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center animate-fade-in max-w-lg mx-auto w-full">
      <div className="w-24 h-24 rounded-full bg-blue-500/20 border-2 border-blue-400 flex items-center justify-center mb-8">
        <User size={40} className="text-blue-400" />
      </div>
      
      <h2 className="large-title-emphasized text-white mb-4">您已签到过</h2>
      <p className="text-white/60 mb-8">
        {event?.mode === 'rolling' 
          ? '您已完成签到，请留意大屏开奖' 
          : '信息保留完毕，将自动为您跳转到抽奖页面'}
      </p>

      {event?.mode !== 'rolling' && (
        <button
          onClick={() => goToPersonalWheel(formData.phone || checkInRecord?.employee_id, checkInRecord)}
          className="w-full py-4 bg-white text-black rounded-2xl font-bold transition-all hover:scale-[1.01] active:scale-[0.99]"
        >
          继续探索
        </button>
      )}
      
      <button
        onClick={() => {
          if (event?.mode === 'rolling') {
            setPageState('rolling_search');
            setEmployeeId('');
            setRollingName('');
          } else {
            setPageState('form');
            setFormData({ name: '', phone: '', company: '' });
          }
          setCheckInRecord(null);
        }}
        className="mt-4 text-white/50 text-sm hover:text-white transition-colors py-2"
      >
        不是我？重新输入
      </button>
    </div>
  );

  const renderError = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center animate-fade-in max-w-lg mx-auto w-full">
      <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mb-6">
        <AlertCircle size={40} className="text-red-400" />
      </div>
      
      <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">遇到问题</h2>
      <p className="text-white/60 mb-8">{error}</p>
      
      <button
        onClick={() => {
          if (event?.mode === 'rolling') {
            setPageState('rolling_search');
          } else {
            setPageState('form');
          }
        }}
        className="px-8 py-3 bg-white text-black rounded-xl font-bold transition-all"
      >
        重试
      </button>
    </div>
  );

  const renderClosed = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center animate-fade-in">
      <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6 border border-white/10">
        <AlertCircle size={40} className="text-white/40" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">活动已结束</h2>
      <p className="text-white/60 mt-2">{error || '感谢您的关注与参与！'}</p>
    </div>
  );

  const renderContent = () => {
    switch (pageState) {
      case 'loading': return renderLoading();
      case 'closed': return renderClosed();
      case 'form': return renderForm();
      case 'rolling_search': return renderRollingSearch();
      case 'get_location': return renderGetLocation();
      case 'checking_in': return renderCheckingIn();
      case 'success': return renderSuccess();
      case 'already_checked': return renderAlreadyChecked();
      case 'error': return renderError();
      default: return renderLoading();
    }
  };

  return (
    <div className="vip-ui relative min-h-screen w-full overflow-hidden text-white bg-black">
      {/* 极简流光背景 */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full mix-blend-screen filter blur-[100px] opacity-20 bg-blue-600" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full mix-blend-screen filter blur-[120px] opacity-20 bg-purple-600" />
      </div>

      <div className="relative z-10 w-full h-full px-4 pb-10">
        <div className="vip-checkin-surface mx-auto w-full max-w-lg">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default CheckInPage;
