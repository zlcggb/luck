import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import CheckInPage from './CheckInPage';
import * as supabaseCheckin from '../utils/supabaseCheckin';
import * as projectSettings from '../utils/projectSettings';

describe('CheckInPage - Employee ID prefix & checkin flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders rolling checkin form with custom employeeId prefix and auto-completes digits', async () => {
    const mockEvent = {
      id: 'fad30511-b527-4944-a6aa-4b2bbf75d36a',
      name: '2026-测试',
      mode: 'rolling' as const,
      require_location: false,
      status: 'active' as const,
    };

    vi.spyOn(supabaseCheckin, 'getEvent').mockResolvedValue(mockEvent as any);
    vi.spyOn(supabaseCheckin, 'getActiveEvent').mockResolvedValue(mockEvent as any);
    vi.spyOn(supabaseCheckin, 'isCheckInOpen').mockResolvedValue({ open: true });
    vi.spyOn(supabaseCheckin, 'getCheckInByEmployee').mockResolvedValue(null);
    vi.spyOn(projectSettings, 'loadProjectSettings').mockResolvedValue({
      employeeIdPrefix: 'U',
    });

    const checkInSpy = vi.spyOn(supabaseCheckin, 'checkIn').mockResolvedValue({
      success: true,
      data: {
        id: 'c-1',
        event_id: mockEvent.id,
        employee_id: 'U0015098',
        name: '周刘成',
        check_in_time: new Date().toISOString(),
      } as any,
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={[`/checkin?event=${mockEvent.id}`]}>
        <CheckInPage />
      </MemoryRouter>
    );

    // 等待表单渲染
    await waitFor(() => {
      expect(screen.getByPlaceholderText('请输入您的姓名')).toBeInTheDocument();
    });

    // 验证左侧前缀直接显示为 U
    expect(screen.getByText('U')).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText('请输入您的姓名');
    const idInput = screen.getByPlaceholderText('请输入工号数字 (如 0015098)');

    // 输入姓名
    await user.type(nameInput, '周刘成');
    // 输入纯数字工号
    await user.type(idInput, '0015098');

    // 触发提交
    const submitBtn = screen.getByRole('button', { name: '签到' });
    await user.click(submitBtn);

    // 验证自动带上前缀 'U' 传给 checkIn
    await waitFor(() => {
      expect(checkInSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: mockEvent.id,
          employeeId: 'U0015098',
          name: '周刘成',
        })
      );
    });

    // 验证签到成功页面展示完整工号 U0015098 以及进入活动抽奖按钮
    await waitFor(() => {
      expect(screen.getByText('签到成功')).toBeInTheDocument();
      expect(screen.getByText('U0015098')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '进入活动抽奖' })).toBeInTheDocument();
      expect(screen.getByText(/秒后将自动进入抽奖页面/)).toBeInTheDocument();
    });
  });

  it('checks for duplicate checkin and renders already_checked state with return button', async () => {
    const mockEvent = {
      id: 'fad30511-b527-4944-a6aa-4b2bbf75d36a',
      name: '2026-测试',
      mode: 'rolling' as const,
      require_location: false,
      status: 'active' as const,
    };

    vi.spyOn(supabaseCheckin, 'getEvent').mockResolvedValue(mockEvent as any);
    vi.spyOn(supabaseCheckin, 'getActiveEvent').mockResolvedValue(mockEvent as any);
    vi.spyOn(supabaseCheckin, 'isCheckInOpen').mockResolvedValue({ open: true });
    vi.spyOn(projectSettings, 'loadProjectSettings').mockResolvedValue({
      employeeIdPrefix: 'U',
    });

    // 模拟该工号已经签到过
    vi.spyOn(supabaseCheckin, 'getCheckInByEmployee').mockResolvedValue({
      id: 'c-dup',
      event_id: mockEvent.id,
      employee_id: 'U0015098',
      name: '周刘成',
      department: '技术研发部',
      check_in_time: new Date().toISOString(),
    } as any);

    const checkInSpy = vi.spyOn(supabaseCheckin, 'checkIn');

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={[`/checkin?event=${mockEvent.id}`]}>
        <CheckInPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('请输入您的姓名')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('请输入您的姓名'), '周刘成');
    await user.type(screen.getByPlaceholderText('请输入工号数字 (如 0015098)'), '0015098');

    await user.click(screen.getByRole('button', { name: '签到' }));

    // 验证查重拦截，不调用 checkIn，直接显示您已签到过并提供进入抽奖页面按钮
    await waitFor(() => {
      expect(screen.getByText('您已签到过')).toBeInTheDocument();
      expect(screen.getByText('该工号已完成签到，请勿重复签到，请留意大屏开奖')).toBeInTheDocument();
      expect(screen.getByText('U0015098')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '进入活动抽奖' })).toBeInTheDocument();
    });
    expect(checkInSpy).not.toHaveBeenCalled();
  });

  it('automatically strips prefix if user pastes full ID like U0015098', async () => {
    const mockEvent = {
      id: 'fad30511-b527-4944-a6aa-4b2bbf75d36a',
      name: '2026-测试',
      mode: 'rolling' as const,
      require_location: false,
      status: 'active' as const,
    };

    vi.spyOn(supabaseCheckin, 'getEvent').mockResolvedValue(mockEvent as any);
    vi.spyOn(supabaseCheckin, 'getActiveEvent').mockResolvedValue(mockEvent as any);
    vi.spyOn(supabaseCheckin, 'isCheckInOpen').mockResolvedValue({ open: true });
    vi.spyOn(projectSettings, 'loadProjectSettings').mockResolvedValue({
      employeeIdPrefix: 'U',
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={[`/checkin?event=${mockEvent.id}`]}>
        <CheckInPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('请输入工号数字 (如 0015098)')).toBeInTheDocument();
    });

    const idInput = screen.getByPlaceholderText('请输入工号数字 (如 0015098)');
    await user.type(idInput, 'U0015098');

    // 验证输入框内只保留数字 0015098，避免重复变成 UU0015098
    expect(idInput).toHaveValue('0015098');
  });

  it('navigates to lottery screen with employee_id query param when entering lottery', async () => {
    const mockEvent = {
      id: 'fad30511-b527-4944-a6aa-4b2bbf75d36a',
      name: '2026-测试',
      mode: 'rolling' as const,
      require_location: false,
      status: 'active' as const,
    };

    vi.spyOn(supabaseCheckin, 'getEvent').mockResolvedValue(mockEvent as any);
    vi.spyOn(supabaseCheckin, 'getActiveEvent').mockResolvedValue(mockEvent as any);
    vi.spyOn(supabaseCheckin, 'isCheckInOpen').mockResolvedValue({ open: true });
    vi.spyOn(projectSettings, 'loadProjectSettings').mockResolvedValue({
      employeeIdPrefix: 'U',
    });
    vi.spyOn(supabaseCheckin, 'getCheckInByEmployee').mockResolvedValue({
      id: 'c-dup',
      event_id: mockEvent.id,
      employee_id: 'U0015098',
      name: '周刘成',
      department: '技术研发部',
      check_in_time: new Date().toISOString(),
    } as any);

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={[`/checkin?event=${mockEvent.id}`]}>
        <CheckInPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('请输入您的姓名')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('请输入您的姓名'), '周刘成');
    await user.type(screen.getByPlaceholderText('请输入工号数字 (如 0015098)'), '0015098');
    await user.click(screen.getByRole('button', { name: '签到' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '进入活动抽奖' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: '进入活动抽奖' }));

    // 验证 sessionStorage 已缓存用户身份
    const stored = sessionStorage.getItem(`luck_user_${mockEvent.id}`);
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored!)).toEqual(expect.objectContaining({
      employeeId: 'U0015098',
      name: '周刘成',
    }));
  });
});
