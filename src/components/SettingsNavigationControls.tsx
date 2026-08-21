import { ArrowLeft, FolderOpen, LogOut, RotateCcw, X } from 'lucide-react';
import AppearanceToggle from './ui/AppearanceToggle';

export const SettingsSidebarHeader = ({ onOpenProjects }: { onOpenProjects: () => void }) => (
  <button
    type="button"
    onClick={onOpenProjects}
    aria-label="返回项目列表"
    className="flex w-full items-center gap-3 rounded-xl px-1 py-1 text-left font-semibold text-[var(--ui-text)] transition-colors hover:text-[var(--ui-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-primary)]"
  >
    <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--ui-primary-soft)] text-[var(--ui-primary)]">
      <FolderOpen size={18} aria-hidden="true" />
    </span>
    <span>项目管理</span>
  </button>
);

interface SettingsPanelTitleBarProps {
  onReturnWorkspace: () => void;
  onReset: () => void;
  onClose: () => void;
}

export const SettingsPanelTitleBar = ({ onReturnWorkspace, onReset, onClose }: SettingsPanelTitleBarProps) => (
  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--ui-border)] p-4">
    <div className="flex items-center gap-3">
      <h2 className="text-xl font-semibold text-[var(--ui-text)]">设置</h2>
      <button
        type="button"
        onClick={onReturnWorkspace}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-soft)] px-3 text-sm font-medium text-[var(--ui-text-secondary)] transition-colors hover:text-[var(--ui-primary)]"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        返回工作台
      </button>
    </div>
    <div className="flex items-center gap-2">
      <AppearanceToggle />
      <button
        type="button"
        onClick={onReset}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[color:var(--ui-danger)]/30 bg-[var(--ui-danger-soft)] px-3 text-sm font-medium text-[var(--ui-danger)]"
      >
        <RotateCcw size={14} aria-hidden="true" />
        <span className="hidden sm:inline">重置数据</span>
      </button>
      <button type="button" onClick={onClose} aria-label="关闭设置" className="vip-icon-button grid h-11 w-11 place-items-center">
        <X size={20} aria-hidden="true" />
      </button>
    </div>
  </div>
);

interface SettingsAccountActionsProps {
  displayName: string;
  email?: string | null;
  onOpenProfile: () => void;
  onLogout: () => void;
}

export const SettingsAccountActions = ({
  displayName,
  email,
  onOpenProfile,
  onLogout,
}: SettingsAccountActionsProps) => (
  <div className="flex items-center gap-2 border-t border-[var(--ui-border)] pt-3">
    <button
      type="button"
      onClick={onOpenProfile}
      aria-label="打开个人信息"
      className="flex min-w-0 flex-1 items-center gap-2 rounded-xl p-1 text-left transition-colors hover:bg-[var(--ui-surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-primary)]"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#2563eb] text-xs font-semibold text-white">
        {(displayName || email || '管').trim().charAt(0).toUpperCase()}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium text-[var(--ui-text)]">{displayName}</span>
        {email && <span className="block truncate text-[10px] text-[var(--ui-text-muted)]">{email}</span>}
      </span>
    </button>
    <button type="button" onClick={onLogout} aria-label="退出登录" title="退出登录" className="vip-icon-button grid h-10 w-10 place-items-center">
      <LogOut size={16} aria-hidden="true" />
    </button>
  </div>
);
