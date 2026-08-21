import type { CSSProperties } from 'react';
import { Clock3, Edit3, Maximize2, Play, QrCode, TrendingUp, UserCheck, Users } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface CheckInStatsProps {
  totalParticipants: number;
  checkedInCount: number;
  checkInPercentage: number;
  lastCheckInTime?: string;
  variant?: 'default' | 'compact' | 'large';
  onEditTotal?: () => void;
  // 二维码相关
  checkInUrl?: string;
  checkInOpen?: boolean;
  onOpenQrModal?: () => void;
  onStartCheckIn?: () => void;
  // 保留旧字段兼容（不再渲染）
  departmentStats?: Array<{ department: string; total: number; checkedIn: number; percentage: number }>;
  showDepartmentStats?: boolean;
}

const formatTime = (isoString: string): string => {
  try {
    return new Date(isoString).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '--:--:--';
  }
};

const CheckInStats = ({
  totalParticipants,
  checkedInCount,
  checkInPercentage,
  lastCheckInTime,
  variant = 'default',
  onEditTotal,
  checkInUrl,
  checkInOpen = true,
  onOpenQrModal,
  onStartCheckIn,
}: CheckInStatsProps) => {
  const total = Math.max(totalParticipants, 0);
  const checked = Math.min(Math.max(checkedInCount, 0), total || checkedInCount);
  const pending = Math.max(total - checked, 0);
  const progress = Math.min(Math.max(checkInPercentage, 0), 100);

  if (variant === 'compact') {
    return (
      <div className="checkin-stats-compact">
        <UserCheck size={16} />
        <strong className="tabular-nums">{checked}</strong>
        <span>/ {total}</span>
        <div className="checkin-progress-track">
          <i style={{ width: `${progress}%` }} />
        </div>
        <b>{progress}%</b>
      </div>
    );
  }

  if (variant !== 'large') {
    return (
      <div className="checkin-stats-default">
        <span><UserCheck size={16} />已签到 <strong>{checked}</strong></span>
        <span><Users size={16} />总人数 <strong>{total}</strong></span>
        <span><TrendingUp size={16} />签到率 <strong>{progress}%</strong></span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 1. 右上角：签到二维码卡片 */}
      <section className="checkin-progress-panel p-5 rounded-3xl border border-[var(--ui-border)] bg-[var(--ui-surface)] shadow-lg" aria-label="签到二维码">
        <header className="checkin-panel-heading flex items-center justify-between pb-3">
          <div className="checkin-panel-title flex items-center gap-2.5">
            <span className="checkin-stat-mark flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500" aria-hidden="true">
              <QrCode size={18} />
            </span>
            <div>
              <p className="checkin-overline text-[10px] font-bold uppercase tracking-wider text-blue-500">QR CHECK-IN</p>
              <h2 className="text-base font-bold text-[var(--ui-text)]">扫码签到</h2>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {checkInOpen ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                <i className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                签到进行中
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                <i className="h-2 w-2 rounded-full bg-amber-500" />
                未开启签到
              </span>
            )}
          </div>
        </header>

        {checkInOpen && checkInUrl ? (
          <div className="flex flex-col items-center justify-center pt-2">
            {/* 二维码展示容器 */}
            <div 
              onClick={onOpenQrModal}
              className="group relative cursor-pointer rounded-2xl bg-white p-4 shadow-md transition-all duration-300 hover:scale-105 hover:shadow-xl ring-1 ring-black/5"
              title="点击放大二维码"
            >
              <QRCodeSVG
                value={checkInUrl}
                size={160}
                level="H"
                includeMargin={false}
              />
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40 opacity-0 backdrop-blur-[2px] transition-opacity group-hover:opacity-100">
                <span className="flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-gray-900 shadow">
                  <Maximize2 size={13} />
                  点击放大
                </span>
              </div>
            </div>

            <p className="mt-3 text-center text-xs font-medium text-[var(--ui-text-muted)]">
              📱 微信 / 手机扫码即刻入场
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--ui-surface-soft)] text-[var(--ui-text-muted)]">
              <QrCode size={28} />
            </div>
            <p className="text-sm font-medium text-[var(--ui-text)]">签到通道尚未开启</p>
            <p className="mt-1 text-xs text-[var(--ui-text-muted)]">开启后将在此处实时展示签到二维码</p>
            {onStartCheckIn && (
              <button
                type="button"
                onClick={onStartCheckIn}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-blue-700 active:scale-95 transition-all"
              >
                <Play size={14} />
                开启签到通道
              </button>
            )}
          </div>
        )}
      </section>

      {/* 2. 右下角：签到进度与人数统计看板 */}
      <section className="checkin-progress-panel p-5 rounded-3xl border border-[var(--ui-border)] bg-[var(--ui-surface)] shadow-lg" aria-labelledby="checkin-progress-title">
        <header className="checkin-panel-heading flex items-center justify-between pb-3">
          <div className="checkin-panel-title flex items-center gap-2.5">
            <span className="checkin-stat-mark flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500" aria-hidden="true">
              <TrendingUp size={18} />
            </span>
            <div>
              <p className="checkin-overline text-[10px] font-bold uppercase tracking-wider text-blue-500">ATTENDANCE</p>
              <h2 id="checkin-progress-title" className="text-base font-bold text-[var(--ui-text)]">签到统计</h2>
            </div>
          </div>
          <span className="checkin-live-chip text-xs font-medium text-blue-500"><i />实时</span>
        </header>

        {/* 进度环与完成度 */}
        <div className="checkin-progress-hero my-2">
          <div className="checkin-progress-ring" role="img" aria-label={`签到率 ${progress}%`} style={{ '--checkin-progress': `${progress}%` } as CSSProperties}>
            <div className="checkin-progress-ring-inner">
              <div><strong className="tabular-nums">{progress}</strong><span>%</span></div>
              <small>签到率</small>
            </div>
          </div>
          <div className="checkin-progress-copy">
            <div className="flex items-center justify-between">
              <p className="text-xs text-[var(--ui-text-muted)]">现场签到完成度</p>
              {onEditTotal && (
                <button
                  type="button"
                  onClick={onEditTotal}
                  className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-[var(--ui-text-muted)] hover:bg-[var(--ui-surface-soft)] hover:text-blue-500 transition-colors"
                  title="设置应到总人数"
                >
                  <Edit3 size={11} />
                  <span>设置总人数</span>
                </button>
              )}
            </div>
            <strong>
              <span className="tabular-nums">{checked}</span>
              <small
                onClick={onEditTotal}
                className={onEditTotal ? 'cursor-pointer hover:text-blue-500 transition-colors' : ''}
                title={onEditTotal ? '点击修改总人数' : undefined}
              >
                {' '}/ {total}
              </small>
            </strong>
            <div className="checkin-progress-track"><i style={{ width: `${progress}%` }} /></div>
            <span className="text-xs text-[var(--ui-text-muted)]">{pending > 0 ? `还有 ${pending} 人待签到` : '全员签到完成'}</span>
          </div>
        </div>

        {/* 3 项核心指标网格 */}
        <div className="checkin-metric-grid mt-4">
          <div className="checkin-metric-card">
            <span className="checkin-metric-icon is-primary"><UserCheck size={17} /></span>
            <div>
              <small>已签到</small>
              <strong className="tabular-nums">{checked}</strong>
            </div>
          </div>
          <div
            className={`checkin-metric-card ${onEditTotal ? 'cursor-pointer hover:border-blue-400 transition-all' : ''}`}
            onClick={onEditTotal}
            title={onEditTotal ? '点击设置活动应到总人数' : undefined}
          >
            <span className="checkin-metric-icon"><Users size={17} /></span>
            <div>
              <div className="flex items-center gap-1">
                <small>待签到</small>
                {onEditTotal && <Edit3 size={10} className="text-[var(--ui-text-muted)]" />}
              </div>
              <strong className="tabular-nums">{pending}</strong>
            </div>
          </div>
          <div className="checkin-metric-card is-wide">
            <span className="checkin-metric-icon"><Clock3 size={17} /></span>
            <div>
              <small>最后签到</small>
              <strong className="tabular-nums">{lastCheckInTime ? formatTime(lastCheckInTime) : '--:--'}</strong>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default CheckInStats;
