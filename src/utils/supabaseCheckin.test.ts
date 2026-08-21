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
});
