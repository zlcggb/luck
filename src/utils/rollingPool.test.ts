import { describe, expect, it } from 'vitest';
import { buildRollingPool, mergeCheckedInParticipant } from './rollingPool';

const participants = [
  { id: 'p1', event_id: 'e1', employee_id: ' A001 ', name: '甲', department: null, avatar: null, status: 'checked_in' as const, created_at: '', updated_at: '' },
  { id: 'p2', event_id: 'e1', employee_id: 'A002', name: '乙', department: null, avatar: null, status: 'pending' as const, created_at: '', updated_at: '' },
];

describe('rolling pool', () => {
  it('contains only checked-in participants and excludes winners', () => {
    expect(buildRollingPool(participants, new Set(['A009']))).toEqual([
      expect.objectContaining({ id: 'A001', name: '甲' }),
    ]);
    expect(buildRollingPool(participants, new Set(['A001']))).toEqual([]);
  });

  it('never falls back to mock data for a database-backed event', () => {
    expect(buildRollingPool([], new Set())).toEqual([]);
  });

  it('merges a realtime check-in idempotently', () => {
    const initial = buildRollingPool(participants, new Set());
    const updated = mergeCheckedInParticipant(initial, {
      ...participants[0],
      name: '甲（更新）',
    });
    expect(updated).toHaveLength(1);
    expect(updated[0].name).toBe('甲（更新）');
  });

  it('ignores pending realtime rows', () => {
    expect(mergeCheckedInParticipant([], participants[1])).toEqual([]);
  });
});
