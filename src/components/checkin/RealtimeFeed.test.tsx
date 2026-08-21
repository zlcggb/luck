import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CheckInRecord } from '../../types/checkin';
import RealtimeFeed from './RealtimeFeed';

const records: CheckInRecord[] = [
  {
    id: 'checkin-1',
    eventId: 'event-1',
    employeeId: 'U001001',
    name: '张三',
    department: '总经办',
    checkInTime: '2026-03-04T17:52:17+08:00',
    checkInMethod: 'qrcode',
    createdAt: '2026-03-04T17:52:17+08:00',
  },
  {
    id: 'checkin-2',
    eventId: 'event-1',
    employeeId: 'U001002',
    name: '李四',
    department: '产品中心',
    checkInTime: '2026-03-04T17:50:00+08:00',
    checkInMethod: 'manual',
    createdAt: '2026-03-04T17:50:00+08:00',
  },
];

describe('RealtimeFeed', () => {
  it('promotes the newest check-in to the stage spotlight', () => {
    render(<RealtimeFeed records={records} />);

    expect(screen.getByRole('heading', { name: '张三' })).toBeInTheDocument();
    expect(screen.getByText('最新签到')).toBeInTheDocument();
    expect(screen.getByText('总经办')).toBeInTheDocument();
    expect(screen.getByText('U001001')).toBeInTheDocument();
    expect(screen.getByText('李四')).toBeInTheDocument();
    expect(screen.getByText('签到序列')).toBeInTheDocument();
  });

  it('shows a deliberate waiting state instead of an empty panel', () => {
    render(<RealtimeFeed records={[]} />);

    expect(screen.getByRole('heading', { name: '等待首位嘉宾签到' })).toBeInTheDocument();
    expect(screen.getByText(/二维码入口已就绪/)).toBeInTheDocument();
  });
});
