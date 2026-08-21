import { useEffect, useRef, useState } from 'react';
import { Activity, Clock3, IdCard, QrCode, Sparkles, Users } from 'lucide-react';
import type { CheckInRecord } from '../../types/checkin';

interface RealtimeFeedProps {
  records: CheckInRecord[];
  maxDisplay?: number;
  autoScroll?: boolean;
  animationStyle?: 'slide' | 'fade' | 'bounce';
}

const formatTime = (isoString: string): string => {
  try {
    return new Date(isoString).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '--:--:--';
  }
};

const RealtimeFeed = ({ records, maxDisplay = 60, autoScroll = true }: RealtimeFeedProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [displayRecords, setDisplayRecords] = useState<CheckInRecord[]>([]);

  useEffect(() => {
    setDisplayRecords(records.slice(0, maxDisplay));
  }, [records, maxDisplay]);

  useEffect(() => {
    if (autoScroll && containerRef.current && typeof containerRef.current.scrollTo === 'function') {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [displayRecords, autoScroll]);

  return (
    <section className="checkin-feed flex h-full flex-col" aria-label="实时签到舞台">
      {/* 顶部标题栏 */}
      <header className="checkin-panel-heading flex items-center justify-between pb-3">
        <div className="checkin-panel-title flex items-center gap-3">
          <span className="checkin-live-mark flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500" aria-hidden="true">
            <Activity size={18} className="animate-pulse" />
          </span>
          <div>
            <p className="checkin-overline text-[10px] font-bold uppercase tracking-wider text-blue-500">LIVE ARRIVALS</p>
            <h2 className="text-lg font-bold text-[var(--ui-text)]">实时签到</h2>
          </div>
        </div>
        <div className="checkin-count-badge flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
          <Users size={14} aria-hidden="true" />
          <strong className="tabular-nums">{records.length}</strong>
          <span>人已签到</span>
        </div>
      </header>

      {/* 核心展示区：下雨动态掉落网格 */}
      <div 
        ref={containerRef} 
        className="checkin-feed-scroll flex-1 overflow-y-auto pr-1 no-scrollbar"
        style={{ minHeight: '460px', maxHeight: 'calc(100vh - 210px)' }}
      >
        {displayRecords.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 p-1">
            {displayRecords.map((record, index) => {
              const isNewest = index === 0;
              const isRecent = index < 3;
              // 模拟下雨掉落延迟（最多前 25 条有交错掉落感）
              const animDelay = `${Math.min(index, 24) * 35}ms`;

              return (
                <article
                  key={record.id || `${record.employeeId}-${record.checkInTime}`}
                  className={`checkin-raindrop-item group relative flex flex-col justify-between rounded-2xl border p-3.5 transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1 hover:shadow-lg ${
                    isNewest
                      ? 'is-new border-blue-500/60 bg-gradient-to-b from-blue-500/15 via-blue-500/5 to-[var(--ui-surface)] shadow-md shadow-blue-500/10'
                      : isRecent
                      ? 'border-violet-500/40 bg-gradient-to-b from-violet-500/10 to-[var(--ui-surface)]'
                      : 'border-[var(--ui-border)] bg-[var(--ui-surface)] hover:border-blue-400/50'
                  }`}
                  style={{ animationDelay: animDelay }}
                >
                  {/* 最新签到徽标 */}
                  {isNewest && (
                    <span className="absolute -top-2 -right-1 flex items-center gap-0.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-2 py-0.5 text-[9px] font-bold text-white shadow-sm animate-pulse">
                      <Sparkles size={9} />
                      最新
                    </span>
                  )}

                  {/* 上部：头像与序号 */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="relative">
                      <img
                        src={record.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${record.employeeId}`}
                        alt={record.name}
                        className={`h-12 w-12 rounded-xl object-cover ring-2 transition-transform duration-300 group-hover:scale-105 ${
                          isNewest ? 'ring-blue-500' : 'ring-blue-400/30'
                        }`}
                        loading="lazy"
                      />
                      <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[8px] text-white shadow">
                        ✓
                      </span>
                    </div>
                    <span className="rounded-md bg-[var(--ui-surface-soft)] px-1.5 py-0.5 text-[10px] font-mono font-medium text-[var(--ui-text-muted)]">
                      #{String(records.length - index).padStart(2, '0')}
                    </span>
                  </div>

                  {/* 中部：姓名与工号 */}
                  <div className="mb-2 min-w-0">
                    <h3 className="truncate text-base font-bold text-[var(--ui-text)] group-hover:text-blue-500 transition-colors">
                      {record.name}
                    </h3>
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-[var(--ui-text-muted)]">
                      <IdCard size={12} className="shrink-0 opacity-70" />
                      <span className="truncate font-mono">{record.employeeId}</span>
                    </div>
                  </div>

                  {/* 底部：签到时间 */}
                  <div className="flex items-center justify-between border-t border-[var(--ui-border)] pt-2 text-[10px] text-[var(--ui-text-muted)]">
                    <span className="flex items-center gap-1">
                      <Clock3 size={11} className="opacity-70" />
                      <time className="font-mono tabular-nums">{formatTime(record.checkInTime)}</time>
                    </span>
                    <span className="text-[9px] opacity-60">
                      {record.checkInMethod === 'manual' ? '现场' : '扫码'}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="checkin-empty-stage flex h-full min-h-[380px] flex-col items-center justify-center text-center p-6">
            <div className="relative mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-500/10 text-blue-500 shadow-[0_8px_30px_rgba(59,130,246,0.15)]">
              <QrCode size={40} className="animate-pulse" />
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex h-4 w-4 rounded-full bg-blue-500"></span>
              </span>
            </div>
            <p className="checkin-overline text-xs font-bold uppercase tracking-wider text-blue-500 mb-1">
              READY FOR ARRIVALS
            </p>
            <h3 className="text-xl font-bold text-[var(--ui-text)] mb-2">等待嘉宾签到入场</h3>
            <p className="max-w-xs text-xs text-[var(--ui-text-muted)] leading-relaxed">
              请扫描右侧二维码完成签到，签到成功后将在此处如雨滴般动态呈现！
            </p>
          </div>
        )}
      </div>
    </section>
  );
};

export default RealtimeFeed;
