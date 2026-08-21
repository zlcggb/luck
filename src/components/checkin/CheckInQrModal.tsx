import { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface CheckInQrModalProps {
  open: boolean;
  eventName: string;
  checkInUrl: string;
  remainingLabel?: string | null;
  onClose: () => void;
}

const CheckInQrModal = ({ open, eventName, checkInUrl, remainingLabel, onClose }: CheckInQrModalProps) => {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  useEffect(() => {
    if (!open) return;
    setCopyState('idle');
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(checkInUrl);
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4 backdrop-blur-xl"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="签到二维码"
        className="ui-surface relative w-full max-w-lg rounded-[28px] border p-6 text-center shadow-2xl sm:p-8"
      >
        <button type="button" onClick={onClose} aria-label="关闭二维码" className="vip-icon-button absolute right-4 top-4 grid h-11 w-11 place-items-center">
          <X size={20} aria-hidden="true" />
        </button>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ui-primary)]">扫码签到</p>
        <h2 className="mt-2 pr-10 text-xl font-semibold text-[var(--ui-text)]">{eventName}</h2>
        {remainingLabel && <p className="mt-2 text-sm text-[var(--ui-text-muted)]">{remainingLabel} 后结束签到</p>}

        <div className="mx-auto mt-6 w-fit rounded-3xl bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,.18)]">
          <QRCodeSVG
            value={checkInUrl}
            size={Math.min(320, Math.max(220, window.innerWidth - 120))}
            level="H"
            bgColor="#ffffff"
            fgColor="#000000"
            title="签到二维码图像"
          />
        </div>

        <p className="mt-5 text-sm text-[var(--ui-text-muted)]">使用微信或系统相机扫描二维码</p>
        {copyState === 'error' && <p role="alert" className="mt-3 text-sm text-[var(--ui-danger)]">复制失败，请手动打开签到页</p>}

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button type="button" onClick={() => void copyLink()} aria-label="复制签到链接" className="vip-button-secondary inline-flex items-center justify-center gap-2 px-4 py-3 font-medium">
            {copyState === 'copied' ? <Check size={17} aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />}
            {copyState === 'copied' ? '已复制' : '复制链接'}
          </button>
          <a href={checkInUrl} target="_blank" rel="noopener noreferrer" aria-label="打开签到页" className="vip-button-primary inline-flex items-center justify-center gap-2 px-4 py-3 font-medium">
            <ExternalLink size={17} aria-hidden="true" /> 打开签到页
          </a>
        </div>
      </section>
    </div>
  );
};

export default CheckInQrModal;
