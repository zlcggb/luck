import { describe, expect, it, vi, beforeEach } from 'vitest';
import { drawRollingWinners, supabase } from './supabaseCheckin';

describe('supabaseCheckin - drawRollingWinners validation & error mapping', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects invalid eventId format before sending RPC', async () => {
    const rpcSpy = vi.spyOn(supabase, 'rpc');
    const result = await drawRollingWinners('invalid-event-id', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 1);

    expect(result.success).toBe(false);
    expect(result.error).toContain('活动 ID 格式无效');
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it('rejects invalid prizeId format before sending RPC', async () => {
    const rpcSpy = vi.spyOn(supabase, 'rpc');
    const result = await drawRollingWinners('fad30511-b527-4944-a6aa-4b2bbf75d36a', 'special', 1);

    expect(result.success).toBe(false);
    expect(result.error).toContain('当前奖项未同步至云端或奖项 ID 无效');
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it('rejects invalid draw count', async () => {
    const rpcSpy = vi.spyOn(supabase, 'rpc');
    const result = await drawRollingWinners('fad30511-b527-4944-a6aa-4b2bbf75d36a', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 0);

    expect(result.success).toBe(false);
    expect(result.error).toContain('单次抽取人数须在 1 到 50 人之间');
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it('maps known Postgres / RPC business errors to friendly messages', async () => {
    vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
      data: null,
      error: { message: 'INSUFFICIENT_ELIGIBLE_PARTICIPANTS' } as any,
      count: null,
      status: 400,
      statusText: 'Bad Request',
    } as any);

    const result = await drawRollingWinners(
      'fad30511-b527-4944-a6aa-4b2bbf75d36a',
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      1
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('抽奖池可用人数不足，请先确认参会人员完成签到');
  });

  it('maps permission & owner errors accurately', async () => {
    vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
      data: null,
      error: { message: 'EVENT_OWNER_REQUIRED' } as any,
      count: null,
      status: 400,
      statusText: 'Bad Request',
    } as any);

    const result = await drawRollingWinners(
      'fad30511-b527-4944-a6aa-4b2bbf75d36a',
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      1
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('当前账号无权操作此活动（需使用活动创建者账号登录）');
  });

  it('returns winning records successfully when RPC succeeds', async () => {
    const mockWinner = {
      id: 'w-1',
      event_id: 'fad30511-b527-4944-a6aa-4b2bbf75d36a',
      prize_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      participant_id: 'p-1',
      employee_id: 'E001',
      name: '张三',
      department: '技术部',
      avatar: 'https://example.com/avatar.png',
      won_at: new Date().toISOString(),
    };

    vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
      data: [mockWinner],
      error: null,
      count: 1,
      status: 200,
      statusText: 'OK',
    } as any);

    const result = await drawRollingWinners(
      'fad30511-b527-4944-a6aa-4b2bbf75d36a',
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      1
    );

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data?.[0].name).toBe('张三');
  });

  it('resets check-in records and participant status', async () => {
    const fromSpy = vi.spyOn(supabase, 'from').mockImplementation(((table: string) => {
      if (table === 'luck_check_ins') {
        return {
          delete: () => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        } as any;
      }
      if (table === 'luck_participants') {
        return {
          update: () => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        } as any;
      }
      return {} as any;
    }) as any);

    const { resetCheckInStatusForEvent } = await import('./supabaseCheckin');
    const success = await resetCheckInStatusForEvent('fad30511-b527-4944-a6aa-4b2bbf75d36a');

    expect(success).toBe(true);
    expect(fromSpy).toHaveBeenCalledWith('luck_check_ins');
    expect(fromSpy).toHaveBeenCalledWith('luck_participants');
  });

  it('correctly identifies event admin based on current auth user and event owner', async () => {
    vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
      data: { user: { id: 'admin-user-1' } as any },
      error: null,
    });

    vi.spyOn(supabase, 'from').mockImplementation(((table: string) => {
      if (table === 'luck_events') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { owner_id: 'admin-user-1' },
                error: null,
              }),
            }),
          }),
        } as any;
      }
      return {} as any;
    }) as any);

    const { checkIsEventAdmin } = await import('./supabaseCheckin');
    const isAdmin = await checkIsEventAdmin('event-123');
    expect(isAdmin).toBe(true);
  });

  it('calls undo_rolling_winner RPC to revoke a winner and restore prize remaining', async () => {
    const rpcSpy = vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: true,
      error: null,
    } as any);

    const { undoRollingWinner } = await import('./supabaseCheckin');
    const result = await undoRollingWinner('event-123', 'winner-uuid-1');

    expect(result.success).toBe(true);
    expect(rpcSpy).toHaveBeenCalledWith('undo_rolling_winner', {
      p_event_id: 'event-123',
      p_winner_id: 'winner-uuid-1',
    });
  });

  it('syncEventPrizes synchronizes modified, new, and deleted prizes', async () => {
    const { syncEventPrizes } = await import('./supabaseCheckin');

    const mockDbPrizes = [
      { id: 'prize-1', name: '特等奖', quantity: 1, remaining: 1, sort_order: 0, image: null, description: 'Car' },
      { id: 'prize-2', name: '一等奖', quantity: 2, remaining: 2, sort_order: 1, image: null, description: 'Phone' },
    ];

    const updatedPrizes = [
      { id: 'prize-1', name: '特等奖(修改)', count: 2, drawn: 0, description: 'New Car', image: 'https://img.com/car.png' },
      { id: 'prize-new-3', name: '新三等奖', count: 5, drawn: 0, description: 'Watch' },
    ];

    let currentDb = [...mockDbPrizes];

    vi.spyOn(supabase, 'from').mockImplementation(((table: string) => {
      if (table === 'luck_prizes') {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: currentDb, error: null }),
            }),
          }),
          update: (data: any) => ({
            eq: (_col: string, id: string) => {
              currentDb = currentDb.map(p => (p.id === id ? { ...p, ...data } : p));
              return Promise.resolve({ error: null });
            },
          }),
          insert: (data: any) => ({
            select: () => ({
              single: () => {
                const inserted = { id: 'prize-generated-id', ...data };
                currentDb.push(inserted);
                return Promise.resolve({ data: inserted, error: null });
              },
            }),
          }),
          delete: () => ({
            eq: (_col: string, id: string) => {
              currentDb = currentDb.filter(p => p.id !== id);
              return Promise.resolve({ error: null });
            },
          }),
        } as any;
      }
      return {} as any;
    }) as any);

    const res = await syncEventPrizes('event-123', updatedPrizes);

    expect(res).toBeDefined();
    // prize-2 should be removed, prize-1 updated, prize-generated-id added
    expect(currentDb.find(p => p.id === 'prize-2')).toBeUndefined();
    expect(currentDb.find(p => p.id === 'prize-1')?.name).toBe('特等奖(修改)');
    expect(currentDb.find(p => p.name === '新三等奖')).toBeDefined();
  });
});

