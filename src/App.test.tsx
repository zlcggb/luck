import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import App from './App';
import * as supabaseCheckin from './utils/supabaseCheckin';
import * as projectSettings from './utils/projectSettings';
import { ModalProvider } from './contexts/ModalContext';
import { UiAppearanceProvider } from './contexts/UiAppearanceContext';

describe('App - User vs Admin views & Lottery Realtime Sync', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('hides draw buttons and settings for ordinary user (isAdmin=false)', async () => {
    const mockEventId = 'fad30511-b527-4944-a6aa-4b2bbf75d36a';

    vi.spyOn(projectSettings, 'loadProjectSettings').mockResolvedValue(null);
    vi.spyOn(supabaseCheckin, 'getCheckedInParticipants').mockResolvedValue([
      { id: 'p-1', event_id: mockEventId, employee_id: 'U0015098', name: '周刘成', department: '技术部', avatar: null, status: 'checked_in', created_at: '', updated_at: '' }
    ] as any);
    vi.spyOn(supabaseCheckin, 'getPrizes').mockResolvedValue([
      { id: 'pz-1', event_id: mockEventId, name: '特等奖', quantity: 1, remaining: 1, sort_order: 1, is_active: true, description: '无人车', image: null, name_en: null, created_at: '', updated_at: '' }
    ] as any);
    vi.spyOn(supabaseCheckin, 'getWinners').mockResolvedValue([]);
    vi.spyOn(supabaseCheckin, 'subscribeToParticipants').mockReturnValue(() => {});
    vi.spyOn(supabaseCheckin, 'subscribeToLotterySync').mockReturnValue(() => {});

    render(
      <MemoryRouter initialEntries={[`/lottery?event=${mockEventId}&employee_id=U0015098`]}>
        <UiAppearanceProvider>
          <ModalProvider>
            <App isAdmin={false} />
          </ModalProvider>
        </UiAppearanceProvider>
      </MemoryRouter>
    );

    // 等待初始化
    await waitFor(() => {
      expect(screen.getAllByText('特等奖').length).toBeGreaterThan(0);
    });

    // 1. 用户端不应存在“抽1人”或“STOP”按钮
    expect(screen.queryByRole('button', { name: /抽\d+人/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'STOP' })).not.toBeInTheDocument();

    // 2. 用户端不应存在“设置”按钮
    expect(screen.queryByTitle('项目与抽奖设置')).not.toBeInTheDocument();

    // 3. 用户端展示工号徽章与现场观战提示
    expect(screen.getByText(/工号: U0015098/)).toBeInTheDocument();
    expect(screen.getByText(/关注现场大屏开奖 · 祝您好运/)).toBeInTheDocument();
  });

  it('renders draw button and settings button for admin (isAdmin=true)', async () => {
    const mockEventId = 'fad30511-b527-4944-a6aa-4b2bbf75d36a';

    vi.spyOn(projectSettings, 'loadProjectSettings').mockResolvedValue(null);
    vi.spyOn(supabaseCheckin, 'getCheckedInParticipants').mockResolvedValue([
      { id: 'p-1', event_id: mockEventId, employee_id: 'U0015098', name: '周刘成', department: '技术部', avatar: null, status: 'checked_in', created_at: '', updated_at: '' }
    ] as any);
    vi.spyOn(supabaseCheckin, 'getPrizes').mockResolvedValue([
      { id: 'pz-1', event_id: mockEventId, name: '特等奖', quantity: 1, remaining: 1, sort_order: 1, is_active: true, description: '无人车', image: null, name_en: null, created_at: '', updated_at: '' }
    ] as any);
    vi.spyOn(supabaseCheckin, 'getWinners').mockResolvedValue([]);
    vi.spyOn(supabaseCheckin, 'subscribeToParticipants').mockReturnValue(() => {});
    vi.spyOn(supabaseCheckin, 'subscribeToLotterySync').mockReturnValue(() => {});

    render(
      <MemoryRouter initialEntries={[`/lottery?event=${mockEventId}&mode=admin`]}>
        <UiAppearanceProvider>
          <ModalProvider>
            <App isAdmin={true} />
          </ModalProvider>
        </UiAppearanceProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText('特等奖').length).toBeGreaterThan(0);
    });

    // 管理员端应展示“抽1人”和“设置”按钮
    expect(screen.getAllByText(/抽1人/).length).toBeGreaterThan(0);
    expect(screen.getByTitle('项目与抽奖设置')).toBeInTheDocument();
  });

  it('syncs draw start, stop and displays winner modal when user is drawn', async () => {
    const mockEventId = 'fad30511-b527-4944-a6aa-4b2bbf75d36a';
    let syncCallbacks: any = null;

    vi.spyOn(projectSettings, 'loadProjectSettings').mockResolvedValue(null);
    vi.spyOn(supabaseCheckin, 'getCheckedInParticipants').mockResolvedValue([
      { id: 'p-1', event_id: mockEventId, employee_id: 'U0015098', name: '周刘成', department: '技术部', avatar: null, status: 'checked_in', created_at: '', updated_at: '' }
    ] as any);
    vi.spyOn(supabaseCheckin, 'getPrizes').mockResolvedValue([
      { id: 'pz-1', event_id: mockEventId, name: '特等奖', quantity: 1, remaining: 1, sort_order: 1, is_active: true, description: '无人车', image: null, name_en: null, created_at: '', updated_at: '' }
    ] as any);
    vi.spyOn(supabaseCheckin, 'getWinners').mockResolvedValue([]);
    vi.spyOn(supabaseCheckin, 'subscribeToParticipants').mockReturnValue(() => {});
    vi.spyOn(supabaseCheckin, 'subscribeToLotterySync').mockImplementation((_eventId, callbacks) => {
      syncCallbacks = callbacks;
      return () => {};
    });

    render(
      <MemoryRouter initialEntries={[`/lottery?event=${mockEventId}&employee_id=U0015098`]}>
        <UiAppearanceProvider>
          <ModalProvider>
            <App isAdmin={false} />
          </ModalProvider>
        </UiAppearanceProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText('特等奖').length).toBeGreaterThan(0);
    });

    // 1. 模拟收到管理员端开始抽奖广播
    expect(syncCallbacks).toBeTruthy();
    syncCallbacks.onBroadcast({
      type: 'DRAW_START',
      prizeId: 'pz-1',
      batchSize: 1,
    });

    await waitFor(() => {
      expect(screen.getByText('🎉 现场大屏正在抽奖中...')).toBeInTheDocument();
    });

    // 2. 模拟收到管理员端开奖结果广播（中奖者为当前用户 U0015098）
    syncCallbacks.onBroadcast({
      type: 'DRAW_STOP',
      prizeId: 'pz-1',
      winners: [{ id: 'U0015098', name: '周刘成', dept: '技术部' }],
    });

    // 3. 验证触发专属中奖祝贺弹窗
    await waitFor(() => {
      expect(screen.getByText('🎉 恭喜您中奖啦！')).toBeInTheDocument();
      expect(screen.getByText('太棒了，收下好运！')).toBeInTheDocument();
    });
  });
});
