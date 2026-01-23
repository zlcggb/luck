import { useMemo } from 'react';
import { Users, UserCheck, Clock, TrendingUp, Building2 } from 'lucide-react';

interface DepartmentStat {
  department: string;
  total: number;
  checkedIn: number;
  percentage: number;
}

interface CheckInStatsProps {
  totalParticipants: number;
  checkedInCount: number;
  checkInPercentage: number;
  lastCheckInTime?: string;
  departmentStats?: DepartmentStat[];
  showDepartmentStats?: boolean;
  variant?: 'default' | 'compact' | 'large';
}

/**
 * 签到统计组件
 * 展示签到进度、部门统计等信息
 */
const CheckInStats = ({
  totalParticipants,
  checkedInCount,
  checkInPercentage,
  lastCheckInTime,
  departmentStats = [],
  showDepartmentStats = true,
  variant = 'default',
}: CheckInStatsProps) => {
  
  const formatTime = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit'
    });
  };

  const progressColor = useMemo(() => {
    if (checkInPercentage >= 80) return 'from-green-500 to-emerald-500';
    if (checkInPercentage >= 50) return 'from-blue-500 to-cyan-500';
    if (checkInPercentage >= 30) return 'from-yellow-500 to-orange-500';
    return 'from-gray-500 to-gray-400';
  }, [checkInPercentage]);

  // 紧凑布局
  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-4 px-4 py-3 bg-white/5 backdrop-blur-xl rounded-xl border border-white/10">
        {/* 已签到 */}
        <div className="flex items-center gap-2">
          <UserCheck size={16} className="text-green-400" />
          <span className="font-bold text-green-400">{checkedInCount}</span>
          <span className="text-gray-500">/</span>
          <span className="text-gray-400">{totalParticipants}</span>
        </div>
        
        {/* 进度 */}
        <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
          <div 
            className={`h-full bg-gradient-to-r ${progressColor} transition-all duration-700 ease-out`}
            style={{ width: `${checkInPercentage}%` }}
          />
        </div>
        
        {/* 百分比 */}
        <span className="text-sm font-bold text-white">{checkInPercentage}%</span>
      </div>
    );
  }

  // 大屏布局
  if (variant === 'large') {
    return (
      <div className="space-y-6">
        {/* 主统计卡片 */}
        <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8">
          {/* 标题 */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500/30 to-emerald-600/20 flex items-center justify-center">
              <TrendingUp size={24} className="text-green-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">签到进度</h3>
              <p className="text-sm text-gray-400">实时统计</p>
            </div>
          </div>
          
          {/* 大数字展示 */}
          <div className="flex items-baseline gap-3 mb-4">
            <span className="text-7xl font-black bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
              {checkedInCount}
            </span>
            <span className="text-3xl text-gray-500">/</span>
            <span className="text-3xl text-gray-400">{totalParticipants}</span>
          </div>
          
          {/* 进度条 */}
          <div className="relative h-4 bg-white/10 rounded-full overflow-hidden mb-4">
            <div 
              className={`absolute inset-y-0 left-0 bg-gradient-to-r ${progressColor} transition-all duration-700 ease-out rounded-full`}
              style={{ width: `${checkInPercentage}%` }}
            >
              {/* 光效 */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
            </div>
          </div>
          
          {/* 统计信息 */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-gray-400">已签到</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-600" />
                <span className="text-gray-400">未签到</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-green-400">
              <span className="text-2xl font-bold">{checkInPercentage}%</span>
            </div>
          </div>
          
          {/* 最后签到时间 */}
          {lastCheckInTime && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/10 text-sm text-gray-400">
              <Clock size={14} className="text-green-400" />
              <span>最后签到: {formatTime(lastCheckInTime)}</span>
            </div>
          )}
        </div>

        {/* 部门统计 */}
        {showDepartmentStats && departmentStats.length > 0 && (
          <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Building2 size={18} className="text-blue-400" />
              <h4 className="font-bold text-white">部门分布</h4>
            </div>
            
            <div className="space-y-3">
              {departmentStats.slice(0, 6).map((dept, idx) => (
                <div key={dept.department} className="group">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-300 truncate max-w-[60%]">
                      {dept.department}
                    </span>
                    <span className="text-sm font-mono text-gray-400">
                      {dept.checkedIn}/{dept.total}
                    </span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                      style={{ 
                        width: `${dept.percentage}%`,
                        transitionDelay: `${idx * 50}ms`
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 默认布局
  return (
    <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
      {/* 主统计 */}
      <div className="flex items-center gap-6 mb-6">
        {/* 已签到 */}
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <UserCheck size={14} className="text-green-400" />
            <span>已签到</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-green-400">{checkedInCount}</span>
            <span className="text-gray-500">人</span>
          </div>
        </div>
        
        {/* 总人数 */}
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <Users size={14} />
            <span>总人数</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-white">{totalParticipants}</span>
            <span className="text-gray-500">人</span>
          </div>
        </div>
        
        {/* 签到率 */}
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <TrendingUp size={14} className="text-blue-400" />
            <span>签到率</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-blue-400">{checkInPercentage}</span>
            <span className="text-gray-500">%</span>
          </div>
        </div>
      </div>
      
      {/* 进度条 */}
      <div className="h-3 bg-white/10 rounded-full overflow-hidden mb-4">
        <div 
          className={`h-full bg-gradient-to-r ${progressColor} transition-all duration-700 ease-out rounded-full`}
          style={{ width: `${checkInPercentage}%` }}
        />
      </div>
      
      {/* 最后签到时间 */}
      {lastCheckInTime && (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Clock size={12} className="text-green-400" />
          <span>最后签到: {formatTime(lastCheckInTime)}</span>
        </div>
      )}
    </div>
  );
};

export default CheckInStats;
