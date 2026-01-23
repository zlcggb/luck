import { useEffect, useRef } from 'react';
import { CheckInRecord } from '../../types/checkin';
import { UserCheck, MapPin, Clock } from 'lucide-react';

interface CheckInCardProps {
  record: CheckInRecord;
  index?: number;
  variant?: 'default' | 'compact' | 'large';
  showAnimation?: boolean;
}

/**
 * 签到者卡片组件
 * 用于展示签到成功的用户信息
 */
const CheckInCard = ({ 
  record, 
  index = 0, 
  variant = 'default',
  showAnimation = true 
}: CheckInCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showAnimation && cardRef.current) {
      cardRef.current.style.opacity = '0';
      cardRef.current.style.transform = 'translateY(20px) scale(0.95)';
      
      const timer = setTimeout(() => {
        if (cardRef.current) {
          cardRef.current.style.transition = 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
          cardRef.current.style.opacity = '1';
          cardRef.current.style.transform = 'translateY(0) scale(1)';
        }
      }, index * 100);
      
      return () => clearTimeout(timer);
    }
  }, [index, showAnimation]);

  const formatTime = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // 紧凑型布局 - 用于列表
  if (variant === 'compact') {
    return (
      <div
        ref={cardRef}
        className="flex items-center gap-3 px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all duration-300"
      >
        {/* 头像 */}
        <img
          src={record.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${record.employeeId}`}
          alt={record.name}
          className="w-10 h-10 rounded-full border-2 border-green-500/50 object-cover"
        />
        
        {/* 信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white truncate">{record.name}</span>
            <span className="text-xs text-gray-500">{record.employeeId}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
            <span className="truncate">{record.department || '未知部门'}</span>
          </div>
        </div>
        
        {/* 时间 */}
        <div className="flex items-center gap-1 text-xs text-green-400 shrink-0">
          <Clock size={12} />
          <span>{formatTime(record.checkInTime)}</span>
        </div>
      </div>
    );
  }

  // 大型布局 - 用于大屏展示
  if (variant === 'large') {
    return (
      <div
        ref={cardRef}
        className="relative overflow-hidden bg-gradient-to-br from-green-500/20 via-emerald-600/15 to-teal-500/10 backdrop-blur-xl border border-green-500/30 rounded-3xl p-6 shadow-[0_0_40px_rgba(34,197,94,0.2)] hover:shadow-[0_0_60px_rgba(34,197,94,0.3)] transition-all duration-500 hover:scale-[1.02]"
      >
        {/* 背景装饰 */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        
        {/* 签到标记 */}
        <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full text-xs font-bold text-white shadow-lg">
          <UserCheck size={14} />
          <span>签到成功</span>
        </div>
        
        {/* 头像 */}
        <div className="flex justify-center mb-4">
          <div className="relative">
            <img
              src={record.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${record.employeeId}`}
              alt={record.name}
              className="w-24 h-24 rounded-2xl border-4 border-green-500/50 object-cover shadow-2xl"
            />
            <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
              <UserCheck size={16} className="text-white" />
            </div>
          </div>
        </div>
        
        {/* 信息 */}
        <div className="text-center">
          <h3 className="text-2xl font-black text-white mb-1">{record.name}</h3>
          <p className="text-green-400 font-medium">{record.department || '未知部门'}</p>
          <p className="text-sm text-gray-400 mt-1">{record.employeeId}</p>
          
          {/* 签到时间 */}
          <div className="flex items-center justify-center gap-2 mt-4 text-sm text-gray-300">
            <Clock size={14} className="text-green-400" />
            <span>{formatTime(record.checkInTime)}</span>
          </div>
          
          {/* 位置信息 */}
          {record.locationValid !== undefined && (
            <div className="flex items-center justify-center gap-2 mt-2 text-xs">
              <MapPin size={12} className={record.locationValid ? 'text-green-400' : 'text-yellow-400'} />
              <span className={record.locationValid ? 'text-green-400' : 'text-yellow-400'}>
                {record.locationValid ? '位置已验证' : '位置未在范围内'}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 默认布局
  return (
    <div
      ref={cardRef}
      className="relative overflow-hidden bg-gradient-to-br from-green-500/15 to-emerald-600/10 backdrop-blur-xl border border-green-500/30 rounded-2xl p-4 shadow-[0_0_25px_rgba(34,197,94,0.15)] hover:shadow-[0_0_40px_rgba(34,197,94,0.25)] transition-all duration-300 hover:scale-[1.02]"
    >
      {/* 背景装饰 */}
      <div className="absolute top-0 right-0 w-20 h-20 bg-green-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
      
      <div className="flex items-center gap-4">
        {/* 头像 */}
        <div className="relative shrink-0">
          <img
            src={record.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${record.employeeId}`}
            alt={record.name}
            className="w-14 h-14 rounded-xl border-2 border-green-500/50 object-cover shadow-lg"
          />
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shadow-md">
            <UserCheck size={10} className="text-white" />
          </div>
        </div>
        
        {/* 信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-white text-lg truncate">{record.name}</h3>
          </div>
          <p className="text-sm text-green-400/80 truncate">{record.department || '未知部门'}</p>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
            <span>{record.employeeId}</span>
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {formatTime(record.checkInTime)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckInCard;
