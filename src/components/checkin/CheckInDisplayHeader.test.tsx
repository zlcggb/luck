import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { UiAppearanceProvider } from '../../contexts/UiAppearanceContext';
import CheckInDisplayHeader from './CheckInDisplayHeader';

const baseProps: ComponentProps<typeof CheckInDisplayHeader> = {
  eventName: '2026 年会',
  connected: true,
  checkInOpen: true,
  remainingTime: 840,
  currentTime: new Date('2026-03-04T03:15:19'),
  soundEnabled: true,
  onBack: vi.fn(),
  onStart: vi.fn(),
  onEnd: vi.fn(),
  onRefresh: vi.fn(),
  onToggleSound: vi.fn(),
  onShowQr: vi.fn(),
  onToggleFullscreen: vi.fn(),
};

const renderHeader = (props = baseProps) => render(
  <UiAppearanceProvider>
    <CheckInDisplayHeader {...props} />
  </UiAppearanceProvider>,
);

describe('CheckInDisplayHeader', () => {
  it('uses one title hierarchy and exposes consistent controls', () => {
    renderHeader();

    expect(screen.getByRole('heading', { name: '2026 年会' })).toBeInTheDocument();
    expect(screen.getByText('签到大屏')).toBeInTheDocument();
    expect(screen.getByText('数据库已连接')).toBeInTheDocument();
    expect(screen.getByText('14:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '结束签到' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '刷新数据' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '关闭提示音' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '显示签到二维码' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '全屏显示' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '切换到深色主题' })).toBeInTheDocument();
  });

  it('switches to a start action when the session is closed', async () => {
    const onStart = vi.fn();
    const user = userEvent.setup();
    renderHeader({ ...baseProps, checkInOpen: false, remainingTime: null, onStart });

    await user.click(screen.getByRole('button', { name: '开始签到' }));
    expect(onStart).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: '结束签到' })).not.toBeInTheDocument();
  });
});
