import { useState } from 'react';
import { AlertTriangle, Check, RefreshCw, SlidersHorizontal, Trash2, UserCheck, UserPlus, Users, X } from 'lucide-react';

interface CheckInManagementModalProps {
  open: boolean;
  totalParticipants: number;
  checkedInCount: number;
  participantListCount: number;
  employeeIdPrefix?: string;
  onClose: () => void;
  onSaveTotalParticipants: (newTotal: number) => Promise<void>;
  onSaveEmployeeIdPrefix?: (newPrefix: string) => Promise<void>;
  onResetCheckIns: () => Promise<void>;
  onInitSampleParticipants: (count: number, prefix?: string) => Promise<void>;
  onClearAllParticipants: () => Promise<void>;
}

const PRESET_TOTALS = [30, 50, 100, 200, 300, 500];
const PRESET_PREFIXES = [
  { label: 'U (默认)', value: 'U' },
  { label: 'E (员工)', value: 'E' },
  { label: 'EMP', value: 'EMP' },
  { label: 'NO', value: 'NO' },
  { label: '无前缀', value: '' },
];

const CheckInManagementModal = ({
  open,
  totalParticipants,
  checkedInCount,
  participantListCount,
  employeeIdPrefix = 'U',
  onClose,
  onSaveTotalParticipants,
  onSaveEmployeeIdPrefix,
  onResetCheckIns,
  onInitSampleParticipants,
  onClearAllParticipants,
}: CheckInManagementModalProps) => {
  const [customTotal, setCustomTotal] = useState(totalParticipants);
  const [isSavingTotal, setIsSavingTotal] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 工号前缀
  const [prefixVal, setPrefixVal] = useState(employeeIdPrefix);
  const [isSavingPrefix, setIsSavingPrefix] = useState(false);
  const [prefixSuccess, setPrefixSuccess] = useState(false);

  // 确认状态
  const [confirmingAction, setConfirmingAction] = useState<'resetCheckIns' | 'initSample' | 'clearAll' | null>(null);
  const [isOperating, setIsOperating] = useState(false);

  if (!open) return null;

  const handleSaveTotal = async (val: number) => {
    if (val <= 0) return;
    setIsSavingTotal(true);
    try {
      await onSaveTotalParticipants(val);
      setCustomTotal(val);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } finally {
      setIsSavingTotal(false);
    }
  };

  const handleSavePrefix = async (val: string) => {
    const clean = val.trim().toUpperCase();
    setIsSavingPrefix(true);
    try {
      if (onSaveEmployeeIdPrefix) {
        await onSaveEmployeeIdPrefix(clean);
      }
      setPrefixVal(clean);
      setPrefixSuccess(true);
      setTimeout(() => setPrefixSuccess(false), 2000);
    } finally {
      setIsSavingPrefix(false);
    }
  };

  const handleExecuteAction = async () => {
    if (!confirmingAction) return;
    setIsOperating(true);
    try {
      if (confirmingAction === 'resetCheckIns') {
        await onResetCheckIns();
      } else if (confirmingAction === 'initSample') {
        await onInitSampleParticipants(30, prefixVal);
      } else if (confirmingAction === 'clearAll') {
        await onClearAllParticipants();
      }
      setConfirmingAction(null);
    } finally {
      setIsOperating(false);
    }
  };

  return (
    <div className="vip-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 animate-modalFadeIn">
      <div className="relative w-full max-w-lg animate-modalSlideUp">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="checkin-mgmt-title"
          className="vip-modal ui-surface relative overflow-hidden rounded-3xl border border-[var(--ui-border)] p-6 sm:p-8 shadow-2xl"
        >
          {/* 头部 */}
          <div className="flex items-center justify-between border-b border-[var(--ui-border)] pb-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/10 text-blue-500">
                <SlidersHorizontal size={20} />
              </div>
              <div>
                <h2 id="checkin-mgmt-title" className="text-lg font-semibold text-[var(--ui-text)]">
                  签到与名单管理
                </h2>
                <p className="text-xs text-[var(--ui-text-muted)]">配置应到人数及重置签到状态</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭管理弹窗"
              className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--ui-border)] text-[var(--ui-text-muted)] hover:bg-[var(--ui-surface-soft)] hover:text-[var(--ui-text)]"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mt-6 space-y-6 max-h-[70vh] overflow-y-auto pr-1">
            {/* 板块 1: 设置总人数 */}
            <div className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface-soft)] p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ui-text)]">
                  <Users size={16} className="text-blue-500" />
                  <span>活动应到总人数（目标签到数）</span>
                </div>
                {saveSuccess && (
                  <span className="flex items-center gap-1 text-xs font-medium text-emerald-500 animate-fadeIn">
                    <Check size={14} /> 已保存
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-[var(--ui-text-muted)]">
                大屏将基于此数值实时计算签到进度率及待签到人数。当前实际名单人数: {participantListCount} 人。
              </p>

              {/* 快捷选择 */}
              <div className="mt-3 grid grid-cols-6 gap-2">
                {PRESET_TOTALS.map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleSaveTotal(num)}
                    disabled={isSavingTotal}
                    className={`rounded-xl py-2 text-xs font-medium transition-all ${
                      customTotal === num
                        ? 'bg-blue-500 text-white shadow-md'
                        : 'border border-[var(--ui-border)] bg-[var(--ui-surface)] text-[var(--ui-text-secondary)] hover:border-blue-400'
                    }`}
                  >
                    {num}人
                  </button>
                ))}
              </div>

              {/* 自定义输入 */}
              <div className="mt-3 flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={customTotal}
                    onChange={e => setCustomTotal(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 py-2 text-sm font-semibold tabular-nums text-[var(--ui-text)] focus:border-blue-500 focus:outline-none"
                    placeholder="输入自定义总人数"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-[var(--ui-text-muted)]">人</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleSaveTotal(customTotal)}
                  disabled={isSavingTotal}
                  className="vip-button-primary shrink-0 px-4 py-2 text-xs font-semibold"
                >
                  {isSavingTotal ? '保存中...' : '应用总人数'}
                </button>
              </div>
            </div>

            {/* 板块 2: 工号前缀设置 */}
            <div className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface-soft)] p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ui-text)]">
                  <span className="grid h-4 w-4 place-items-center rounded bg-blue-500/20 text-[10px] font-bold text-blue-500">#</span>
                  <span>工号前缀设置（默认 U）</span>
                </div>
                {prefixSuccess && (
                  <span className="flex items-center gap-1 text-xs font-medium text-emerald-500 animate-fadeIn">
                    <Check size={14} /> 已保存
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-[var(--ui-text-muted)]">
                设置后手机扫码签到将自动匹配并引导该前缀（例如 U0015098），生成名单也会使用此前缀。
              </p>

              {/* 快捷选择 */}
              <div className="mt-3 grid grid-cols-5 gap-2">
                {PRESET_PREFIXES.map(item => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => handleSavePrefix(item.value)}
                    disabled={isSavingPrefix}
                    className={`rounded-xl py-2 text-xs font-medium transition-all ${
                      prefixVal === item.value
                        ? 'bg-blue-500 text-white shadow-md'
                        : 'border border-[var(--ui-border)] bg-[var(--ui-surface)] text-[var(--ui-text-secondary)] hover:border-blue-400'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* 自定义前缀输入 */}
              <div className="mt-3 flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    maxLength={8}
                    value={prefixVal}
                    onChange={e => setPrefixVal(e.target.value.toUpperCase())}
                    className="w-full rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 py-2 text-sm font-semibold uppercase text-[var(--ui-text)] focus:border-blue-500 focus:outline-none"
                    placeholder="输入自定义工号前缀 (如 U, E, EMP)"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleSavePrefix(prefixVal)}
                  disabled={isSavingPrefix}
                  className="vip-button-primary shrink-0 px-4 py-2 text-xs font-semibold"
                >
                  {isSavingPrefix ? '保存中...' : '保存前缀'}
                </button>
              </div>
            </div>

            {/* 板块 3: 清除已签到人员 */}
            <div className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface-soft)] p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ui-text)]">
                  <UserCheck size={16} className="text-emerald-500" />
                  <span>已签到记录管理</span>
                </div>
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-500">
                  当前已签到 {checkedInCount} 人
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--ui-text-muted)]">
                清空当前活动的入场记录并将参会人员状态重置为未签到，大屏实时卡片与签到序列将清空。已有名单不会被删除。
              </p>

              <div className="mt-4">
                {confirmingAction === 'resetCheckIns' ? (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 animate-fadeIn">
                    <div className="flex items-start gap-2 text-rose-500">
                      <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                      <p className="text-xs leading-relaxed">
                        确定要清空所有已签到数据吗？重置后签到大屏将恢复为空白待签到状态。
                      </p>
                    </div>
                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmingAction(null)}
                        disabled={isOperating}
                        className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 py-1.5 text-xs font-medium text-[var(--ui-text)]"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={handleExecuteAction}
                        disabled={isOperating}
                        className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-700"
                      >
                        {isOperating ? '清空中...' : '确认清空签到'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingAction('resetCheckIns')}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/5 py-2.5 text-xs font-semibold text-rose-600 transition-all hover:bg-rose-500/15"
                  >
                    <RefreshCw size={14} />
                    <span>清除已签到人员（重置签到记录）</span>
                  </button>
                )}
              </div>
            </div>

            {/* 板块 3: 名单初始化与清空 */}
            <div className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface-soft)] p-4 sm:p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ui-text)]">
                <UserPlus size={16} className="text-violet-500" />
                <span>名单初始化与重置</span>
              </div>
              <p className="mt-1 text-xs text-[var(--ui-text-muted)]">
                支持一键快速生成包含工号、部门的标准演示人员名单，或彻底清空人员名单。
              </p>

              <div className="mt-4 space-y-3">
                {confirmingAction === 'initSample' ? (
                  <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-3 animate-fadeIn">
                    <p className="text-xs text-[var(--ui-text)] leading-relaxed">
                      将为您一键生成 30 位已完成签到的预设员工名单（可直接用于大屏展示与抽奖演练）。确定继续吗？
                    </p>
                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmingAction(null)}
                        disabled={isOperating}
                        className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 py-1.5 text-xs font-medium text-[var(--ui-text)]"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={handleExecuteAction}
                        disabled={isOperating}
                        className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-violet-700"
                      >
                        {isOperating ? '生成中...' : '确认生成名单'}
                      </button>
                    </div>
                  </div>
                ) : confirmingAction === 'clearAll' ? (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 animate-fadeIn">
                    <p className="text-xs text-rose-500 leading-relaxed font-medium">
                      ⚠️ 确定要清空全部名单人员吗？此操作将删除所有导入的人员数据及签到数据。
                    </p>
                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmingAction(null)}
                        disabled={isOperating}
                        className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 py-1.5 text-xs font-medium text-[var(--ui-text)]"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={handleExecuteAction}
                        disabled={isOperating}
                        className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-700"
                      >
                        {isOperating ? '清空中...' : '确认清空所有人'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmingAction('initSample')}
                      className="flex items-center justify-center gap-2 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] py-2.5 text-xs font-medium text-[var(--ui-text)] hover:border-violet-400"
                    >
                      <UserPlus size={14} className="text-violet-500" />
                      <span>一键生成演示名单(30人)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingAction('clearAll')}
                      className="flex items-center justify-center gap-2 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] py-2.5 text-xs font-medium text-[var(--ui-text-muted)] hover:border-rose-400 hover:text-rose-500"
                    >
                      <Trash2 size={14} />
                      <span>清空全部名单</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="vip-button-secondary px-6 py-2.5 text-xs font-semibold"
            >
              完成
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default CheckInManagementModal;
