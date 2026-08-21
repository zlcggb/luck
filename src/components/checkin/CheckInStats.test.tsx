import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CheckInStats from './CheckInStats';

describe('CheckInStats', () => {
  it('renders a progress command panel with semantic metrics', () => {
    render(
      <CheckInStats
        totalParticipants={30}
        checkedInCount={12}
        checkInPercentage={40}
        lastCheckInTime="2026-03-04T17:52:17+08:00"
        departmentStats={[{ department: '总经办', checkedIn: 4, total: 5, percentage: 80 }]}
        variant="large"
      />,
    );

    expect(screen.getByRole('img', { name: '签到率 40%' })).toBeInTheDocument();
    expect(screen.getAllByText('12')).toHaveLength(2);
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText('总经办')).toBeInTheDocument();
    expect(screen.getByText('4 / 5')).toBeInTheDocument();
  });
});
