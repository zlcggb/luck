import { useEffect, useRef, useState } from 'react';
import { CheckInRecord } from '../../types/checkin';
import CheckInCard from './CheckInCard';
import { Activity, Users } from 'lucide-react';

interface RealtimeFeedProps {
  records: CheckInRecord[];
  maxDisplay?: number;
  autoScroll?: boolean;
  animationStyle?: 'slide' | 'fade' | 'bounce';
}

/**
 * 实时签到动态组件
 * 用于大屏展示实时签到信息
 */
const RealtimeFeed = ({
  records,
  maxDisplay = 10,
  autoScroll = true,
  animationStyle = 'slide',
}: RealtimeFeedProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [displayRecords, setDisplayRecords] = useState<CheckInRecord[]>([]);
  const prevRecordsRef = useRef<CheckInRecord[]>([]);

  // 更新显示的记录，处理新增动画
  useEffect(() => {
    const prevIds = new Set(prevRecordsRef.current.map(r => r.id));
    const newRecords = records.filter(r => !prevIds.has(r.id));
    
    // 如果有新记录，触发动画
    if (newRecords.length > 0) {
      setDisplayRecords(records.slice(0, maxDisplay));
    } else {
      setDisplayRecords(records.slice(0, maxDisplay));
    }
    
    prevRecordsRef.current = records;
  }, [records, maxDisplay]);

  // 自动滚动到底部
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  }, [displayRecords, autoScroll]);

  const getAnimationClass = (index: number) => {
    const delay = `${index * 50}ms`;
    switch (animationStyle) {
      case 'slide':
        return {
          animation: `slideIn 0.5s ease-out ${delay} forwards`,
          opacity: 0,
          transform: 'translateX(-20px)',
        };
      case 'bounce':
        return {
          animation: `bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) ${delay} forwards`,
          opacity: 0,
          transform: 'scale(0.8)',
        };
      case 'fade':
      default:
        return {
          animation: `fadeIn 0.4s ease-out ${delay} forwards`,
          opacity: 0,
        };
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* 标题 */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Activity size={20} className="text-green-400" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-ping" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" />
          </div>
          <h3 className="text-lg font-bold text-white">实时动态</h3>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Users size={14} />
          <span>{records.length} 人已签到</span>
        </div>
      </div>

      {/* 签到列表 */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto space-y-3 no-scrollbar pr-2"
      >
        {displayRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 py-12">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <Users size={28} className="text-gray-600" />
            </div>
            <p className="text-center">暂无签到记录</p>
            <p className="text-sm text-gray-600 mt-1">等待第一位签到者...</p>
          </div>
        ) : (
          displayRecords.map((record, index) => (
            <div
              key={record.id}
              style={getAnimationClass(index)}
              className="transform-gpu"
            >
              <CheckInCard 
                record={record} 
                variant="compact"
                showAnimation={false}
              />
            </div>
          ))
        )}
      </div>

      {/* 底部提示 */}
      {records.length > maxDisplay && (
        <div className="pt-3 mt-3 border-t border-white/10 text-center text-sm text-gray-500 shrink-0">
          显示最新 {maxDisplay} 条记录，共 {records.length} 人签到
        </div>
      )}

      {/* 动画样式 */}
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        @keyframes bounceIn {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          50% {
            transform: scale(1.05);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default RealtimeFeed;
