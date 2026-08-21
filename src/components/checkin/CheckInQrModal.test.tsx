import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CheckInQrModal from './CheckInQrModal';

describe('CheckInQrModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('shows one scannable dialog with copy and open actions', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    render(
      <CheckInQrModal
        open
        eventName="2026 年会"
        checkInUrl="https://example.com/checkin?event=e1"
        remainingLabel="14:00"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog', { name: '签到二维码' })).toBeInTheDocument();
    expect(screen.getByText('2026 年会')).toBeInTheDocument();
    expect(screen.getByText('14:00 后结束签到')).toBeInTheDocument();
    expect(screen.getByTitle('签到二维码图像')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '打开签到页' })).toHaveAttribute('href', 'https://example.com/checkin?event=e1');

    await user.click(screen.getByRole('button', { name: '复制签到链接' }));
    expect(writeText).toHaveBeenCalledWith('https://example.com/checkin?event=e1');
    expect(await screen.findByText('已复制')).toBeInTheDocument();
  });

  it('closes with Escape and reports clipboard failure', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('blocked'));
    render(
      <CheckInQrModal
        open
        eventName="活动"
        checkInUrl="https://example.com/checkin"
        onClose={onClose}
      />,
    );

    await user.click(screen.getByRole('button', { name: '复制签到链接' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('复制失败');
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders nothing while closed', () => {
    render(<CheckInQrModal open={false} eventName="活动" checkInUrl="https://example.com" onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
