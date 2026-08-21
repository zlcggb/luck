import {
  ArrowLeft,
  Clock3,
  Maximize,
  Play,
  QrCode,
  RefreshCw,
  Square,
  Sparkles,
  Timer,
  Volume2,
  VolumeX,
} from 'lucide-react';
import AppearanceToggle from '../ui/AppearanceToggle';

interface CheckInDisplayHeaderProps {
  eventName: string;
  connected: boolean;
  checkInOpen: boolean;
  remainingTime: number | null;
  currentTime: Date;
  soundEnabled: boolean;
  onBack?: () => void;
  onStart: () => void;
  onEnd: () => void;
  onRefresh: () => void;
  onToggleSound: () => void;
  onShowQr: () => void;
  onToggleFullscreen: () => void;
}

export const formatCheckInRemainingTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const toolButtonClass = 'checkin-tool-button grid h-11 w-11 shrink-0 place-items-center';

const CheckInDisplayHeader = ({
  eventName,
  connected,
  checkInOpen,
  remainingTime,
  currentTime,
  soundEnabled,
  onBack,
  onStart,
  onEnd,
  onRefresh,
  onToggleSound,
  onShowQr,
  onToggleFullscreen,
}: CheckInDisplayHeaderProps) => (
  <header className="checkin-command-bar">
    <div className="checkin-brand-block">
      {onBack && (
        <button type="button" onClick={onBack} aria-label="返回抽奖页面" className={toolButtonClass}>
          <ArrowLeft size={19} aria-hidden="true" />
        </button>
      )}
      <span className="checkin-brand-glyph" aria-hidden="true"><Sparkles size={20} /></span>
      <div className="checkin-brand-copy">
        <p className="checkin-overline">LIVE CHECK-IN</p>
        <div className="checkin-title-line">
          <h1>{eventName}</h1>
          <span>签到大屏</span>
        </div>
        <div className="checkin-connection-state">
          <i className={connected ? 'is-connected' : 'is-disconnected'} />
          <span>{connected ? '数据库已连接' : '数据库未连接'}</span>
          <span className="hidden sm:inline">实时数据同步</span>
        </div>
      </div>
    </div>

    <div className="checkin-command-actions">
      {checkInOpen ? (
        <>
          <div className={`checkin-session-pill ${
            remainingTime !== null && remainingTime <= 60
              ? 'is-critical'
              : remainingTime !== null && remainingTime <= 300
                ? 'is-warning'
                : ''
          }`}>
            <Timer size={16} aria-hidden="true" />
            <span className="tabular-nums">
              {remainingTime === null ? '签到进行中' : formatCheckInRemainingTime(remainingTime)}
            </span>
            {remainingTime !== null && <small>剩余</small>}
          </div>
          <button
            type="button"
            onClick={onEnd}
            aria-label="结束签到"
            className="checkin-end-button"
          >
            <Square size={15} aria-hidden="true" />
            <span className="hidden lg:inline">结束签到</span>
          </button>
        </>
      ) : (
        <button type="button" onClick={onStart} aria-label="开始签到" className="checkin-start-button">
          <Play size={17} aria-hidden="true" /> 开始签到
        </button>
      )}

      <div className="checkin-current-time">
        <Clock3 size={15} aria-hidden="true" />
        {currentTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>

      <div className="checkin-tool-group">
        <button type="button" onClick={onRefresh} aria-label="刷新数据" className={toolButtonClass}><RefreshCw size={18} aria-hidden="true" /></button>
        <button type="button" onClick={onToggleSound} aria-label={soundEnabled ? '关闭提示音' : '开启提示音'} className={toolButtonClass}>
          {soundEnabled ? <Volume2 size={18} aria-hidden="true" /> : <VolumeX size={18} aria-hidden="true" />}
        </button>
        <span className="checkin-appearance-toggle"><AppearanceToggle /></span>
        <button type="button" onClick={onShowQr} aria-label="显示签到二维码" className={toolButtonClass}><QrCode size={18} aria-hidden="true" /></button>
        <button type="button" onClick={onToggleFullscreen} aria-label="全屏显示" className={toolButtonClass}><Maximize size={18} aria-hidden="true" /></button>
      </div>
    </div>
  </header>
);

export default CheckInDisplayHeader;
