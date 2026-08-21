import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CheckInStats from './CheckInStats';

describe('CheckInStats', () => {
  it('renders a progress command panel with semantic metrics and qr code section', () => {
    render(
      <CheckInStats
        totalParticipants={30}
        checkedInCount={12}
        checkInPercentage={40}
        lastCheckInTime="2026-03-04T17:52:17+08:00"
        checkInUrl="https://example.com/checkin?event=1"
        checkInOpen={true}
        variant="large"
      />,
    );

    expect(screen.getByText('扫码签到')).toBeInTheDocument();
    expect(screen.getByText('签到进行中')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '签到率 40%' })).toBeInTheDocument();
    expect(screen.getAllByText('12')).toHaveLength(2);
    expect(screen.getByText('18')).toBeInTheDocument();
  });

  it('triggers onEditTotal callback when clicking total editing buttons', async () => {
    const onEditTotal = vi.fn();
    render(
      <CheckInStats
        totalParticipants={50}
        checkedInCount={10}
        checkInPercentage={20}
        onEditTotal={onEditTotal}
        variant="large"
      />,
    );

    const editBtn = screen.getByRole('button', { name: '设置总人数' });
    expect(editBtn).toBeInTheDocument();
    editBtn.click();
    expect(onEditTotal).toHaveBeenCalled();
  });
});
