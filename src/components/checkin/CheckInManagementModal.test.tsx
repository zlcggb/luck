import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CheckInManagementModal from './CheckInManagementModal';

describe('CheckInManagementModal', () => {
  const defaultProps = {
    open: true,
    totalParticipants: 100,
    checkedInCount: 15,
    participantListCount: 20,
    onClose: vi.fn(),
    onSaveTotalParticipants: vi.fn().mockResolvedValue(undefined),
    onResetCheckIns: vi.fn().mockResolvedValue(undefined),
    onInitSampleParticipants: vi.fn().mockResolvedValue(undefined),
    onClearAllParticipants: vi.fn().mockResolvedValue(undefined),
  };

  it('renders modal with target participant input and actions', () => {
    render(<CheckInManagementModal {...defaultProps} />);

    expect(screen.getByText('签到与名单管理')).toBeInTheDocument();
    expect(screen.getByText('当前已签到 15 人')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '清除已签到人员（重置签到记录）' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '一键生成演示名单(30人)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '清空全部名单' })).toBeInTheDocument();
  });

  it('allows selecting preset total and calls onSaveTotalParticipants', async () => {
    const user = userEvent.setup();
    const onSaveTotal = vi.fn().mockResolvedValue(undefined);
    render(<CheckInManagementModal {...defaultProps} onSaveTotalParticipants={onSaveTotal} />);

    const btn50 = screen.getByRole('button', { name: '50人' });
    await user.click(btn50);

    expect(onSaveTotal).toHaveBeenCalledWith(50);
  });

  it('requires confirmation before resetting check-ins', async () => {
    const user = userEvent.setup();
    const onReset = vi.fn().mockResolvedValue(undefined);
    render(<CheckInManagementModal {...defaultProps} onResetCheckIns={onReset} />);

    const resetBtn = screen.getByRole('button', { name: '清除已签到人员（重置签到记录）' });
    await user.click(resetBtn);

    expect(screen.getByText(/确定要清空所有已签到数据吗/)).toBeInTheDocument();
    expect(onReset).not.toHaveBeenCalled();

    const confirmBtn = screen.getByRole('button', { name: '确认清空签到' });
    await user.click(confirmBtn);

    expect(onReset).toHaveBeenCalledOnce();
  });

  it('requires confirmation before generating sample participants', async () => {
    const user = userEvent.setup();
    const onInitSample = vi.fn().mockResolvedValue(undefined);
    render(<CheckInManagementModal {...defaultProps} onInitSampleParticipants={onInitSample} />);

    const initBtn = screen.getByRole('button', { name: '一键生成演示名单(30人)' });
    await user.click(initBtn);

    expect(screen.getByText(/将为您一键生成 30 位已完成签到的预设员工名单/)).toBeInTheDocument();
    expect(onInitSample).not.toHaveBeenCalled();

    const confirmBtn = screen.getByRole('button', { name: '确认生成名单' });
    await user.click(confirmBtn);

    expect(onInitSample).toHaveBeenCalledWith(30, 'U');
  });

  it('allows changing employee ID prefix and calls onSaveEmployeeIdPrefix', async () => {
    const user = userEvent.setup();
    const onSavePrefix = vi.fn().mockResolvedValue(undefined);
    render(<CheckInManagementModal {...defaultProps} onSaveEmployeeIdPrefix={onSavePrefix} />);

    expect(screen.getByText('工号前缀设置（默认 U）')).toBeInTheDocument();
    const btnE = screen.getByRole('button', { name: 'E (员工)' });
    await user.click(btnE);

    expect(onSavePrefix).toHaveBeenCalledWith('E');
  });
});
