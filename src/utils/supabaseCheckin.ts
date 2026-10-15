// ============================================
// Supabase 签到服务
// ============================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const SUPABASE_PROXY_PREFIX = '/supabase-api';

/**
 * 构建支持同源反向代理（/supabase-api）与直连自动回退的 Fetch 适配器
 * 解决中国移动等网络环境下 *.supabase.co 域名被 DNS 污染或阻断的问题
 */
export const createSupabaseFetch = (
  targetOrigin: string,
  baseFetch: typeof fetch = fetch,
  options?: { forceProxyInTest?: boolean }
): typeof fetch => {
  const cleanTargetOrigin = (targetOrigin || '').replace(/\/+$/, '');

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const rawUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    const isTestEnv =
      !options?.forceProxyInTest &&
      typeof import.meta !== 'undefined' &&
      import.meta.env?.MODE === 'test';
    const hasWindowOrigin =
      typeof window !== 'undefined' &&
      Boolean(window.location?.origin) &&
      /^https?:\/\//i.test(window.location.origin);

    if (!isTestEnv && hasWindowOrigin && cleanTargetOrigin && rawUrl.startsWith(cleanTargetOrigin)) {
      const pathAndQuery = rawUrl.slice(cleanTargetOrigin.length);
      const proxiedUrl = `${window.location.origin}${SUPABASE_PROXY_PREFIX}${pathAndQuery}`;

      try {
        const proxyRequest =
          input instanceof Request ? new Request(proxiedUrl, input.clone()) : proxiedUrl;
        const proxyResponse = await baseFetch(proxyRequest, init);
        const contentType = proxyResponse.headers?.get('content-type') || '';

        // 若未命中 SPA fallback（非 text/html），直接使用同源代理响应
        if (!contentType.includes('text/html')) {
          return proxyResponse;
        }
      } catch {
        // 同源代理不可用时自动回退到直连 Supabase
      }
    }

    return baseFetch(input, init);
  };
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: createSupabaseFetch(supabaseUrl),
  },
});

// 默认活动ID
export const DEFAULT_EVENT_ID = '5576b391-5748-44e7-aa05-721845a764e0';

// ============================================
// 类型定义
// ============================================

// 用户
export interface LuckUser {
  id: string;
  auth_id: string | null;
  email: string;
  name: string;
  avatar: string | null;
  phone: string | null;
  company: string | null;
  role: 'admin' | 'user';
  created_at: string;
  updated_at: string;
}

// 项目/活动
export interface LuckEvent {
  id: string;
  name: string;
  description: string | null;
  event_date: string;
  location_name: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_radius: number;
  require_location: boolean;
  status: 'draft' | 'active' | 'completed';
  mode: 'wheel' | 'rolling';
  owner_id: string | null;
  cover_image: string | null;
  settings: Record<string, unknown>;
  // 签到会话状态
  checkin_open: boolean | null;
  checkin_start_time: string | null;
  checkin_end_time: string | null;
  checkin_duration: number | null;
  created_at: string;
  updated_at: string;
}

// 奖项
export interface LuckPrize {
  id: string;
  event_id: string;
  name: string;
  name_en: string | null;   // 英文奖项名称
  description: string | null;
  image: string | null;
  quantity: number;
  remaining: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// 中奖记录
export interface LuckWinner {
  id: string;
  event_id: string;
  prize_id: string;
  participant_id: string | null;
  employee_id: string;
  name: string;
  department: string | null;
  avatar: string | null;
  phone: string | null;
  company: string | null;
  redeem_code: string | null;
  redeemed_at: string | null;
  status: 'pending' | 'redeemed';
  won_at: string;
  created_at: string;
  // 关联数据
  prize?: LuckPrize;
}

// 参与者
export interface LuckParticipant {
  id: string;
  event_id: string;
  employee_id: string;
  name: string;
  department: string | null;
  avatar: string | null;
  status: 'pending' | 'checked_in';
  created_at: string;
  updated_at: string;
}


export interface LuckCheckIn {
  id: string;
  event_id: string;
  participant_id: string | null;
  employee_id: string;
  name: string;
  department: string | null;
  avatar: string | null;
  check_in_time: string;
  location_lat: number | null;
  location_lng: number | null;
  location_accuracy: number | null;
  location_valid: boolean | null;
  device_info: Record<string, unknown> | null;
  ip_address: string | null;
  check_in_method: 'qrcode' | 'manual';
  created_at: string;
}

// ============================================
// 活动 API
// ============================================

export type EventFetchErrorType = 'network' | 'not_found' | null;

let lastEventFetchErrorType: EventFetchErrorType = null;

export const isNetworkFetchError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const msg = String((error as { message?: unknown }).message || '');
  const details = String((error as { details?: unknown }).details || '');
  const combined = `${msg} ${details}`.toLowerCase();
  return (
    combined.includes('failed to fetch') ||
    combined.includes('fetch failed') ||
    combined.includes('networkerror') ||
    combined.includes('load failed') ||
    combined.includes('network request failed')
  );
};

export const getLastEventErrorType = (): EventFetchErrorType => lastEventFetchErrorType;

export const getEvent = async (eventId: string = DEFAULT_EVENT_ID): Promise<LuckEvent | null> => {
  lastEventFetchErrorType = null;
  const { data, error } = await supabase
    .from('luck_events')
    .select('*')
    .eq('id', eventId)
    .single();
  
  if (error) {
    lastEventFetchErrorType = isNetworkFetchError(error) ? 'network' : 'not_found';
    console.error('获取活动失败:', error);
    return null;
  }
  return data;
};

export const getActiveEvent = async (): Promise<LuckEvent | null> => {
  lastEventFetchErrorType = null;
  const { data, error } = await supabase
    .from('luck_events')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (error) {
    lastEventFetchErrorType = isNetworkFetchError(error) ? 'network' : 'not_found';
    console.error('获取活动失败:', error);
    return null;
  }
  return data;
};

// ============================================
// 签到 API
// ============================================

export interface CheckInParams {
  eventId: string;
  employeeId: string;
  name: string;
  department?: string;
  avatar?: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
}

export const checkIn = async (params: CheckInParams): Promise<{ success: boolean; data?: LuckCheckIn; error?: string }> => {
  const { eventId, employeeId, name, department, avatar, location } = params;

  const { data, error } = await supabase
    .rpc('participant_check_in', {
      p_event_id: eventId,
      p_employee_id: employeeId,
      p_name: name,
      p_department: department || null,
      p_avatar: avatar || null,
      p_location_lat: location?.latitude ?? null,
      p_location_lng: location?.longitude ?? null,
      p_location_accuracy: location?.accuracy ?? null,
      p_check_in_method: 'qrcode',
    })
    .single();

  if (error) {
    console.error('签到失败:', error);
    const messages: Record<string, string> = {
      CHECK_IN_CLOSED: '签到通道未开启或已经结束',
      EVENT_NOT_FOUND: '活动不存在或已失效',
      LOCATION_REQUIRED: '本活动需要获取定位后才能签到',
      OUTSIDE_CHECK_IN_RANGE: '您不在活动签到范围内',
      INVALID_EMPLOYEE_ID: '请输入有效的工号',
      INVALID_NAME: '请输入有效的姓名',
    };
    const knownError = Object.entries(messages).find(([code]) => error.message.includes(code));
    return { success: false, error: knownError?.[1] || '签到失败，请重试' };
  }

  return { success: true, data: data as LuckCheckIn };
};

export const getCheckInByEmployee = async (eventId: string, employeeId: string): Promise<LuckCheckIn | null> => {
  const cleanId = employeeId.trim().toUpperCase();
  const { data, error } = await supabase
    .from('luck_check_ins')
    .select('*')
    .eq('event_id', eventId)
    .eq('employee_id', cleanId)
    .maybeSingle();

  if (error) {
    return null;
  }
  return data;
};

export const getCheckInById = async (eventId: string, checkInId: string): Promise<LuckCheckIn | null> => {
  const { data, error } = await supabase
    .rpc('get_check_in_by_token', {
      p_event_id: eventId,
      p_check_in_id: checkInId,
    })
    .maybeSingle();

  if (error) return null;
  return data as LuckCheckIn | null;
};

export const getPersonalWheelWinner = async (
  eventId: string,
  checkInId: string
): Promise<LuckWinner | null> => {
  const { data, error } = await supabase
    .rpc('get_personal_wheel_winner', {
      p_event_id: eventId,
      p_check_in_id: checkInId,
    })
    .maybeSingle();

  if (error) return null;
  return data as LuckWinner | null;
};

// ============================================
// 签到记录查询
// ============================================

export const getCheckInRecords = async (eventId: string, limit: number = 50): Promise<LuckCheckIn[]> => {
  const { data, error } = await supabase
    .from('luck_check_ins')
    .select('*')
    .eq('event_id', eventId)
    .order('check_in_time', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('获取签到记录失败:', error);
    return [];
  }
  return data || [];
};

export const getCheckInCount = async (eventId: string): Promise<number> => {
  const { count, error } = await supabase
    .from('luck_check_ins')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId);

  if (error) {
    console.error('获取签到人数失败:', error);
    return 0;
  }
  return count || 0;
};

// ============================================
// 实时订阅
// ============================================

export const subscribeToCheckIns = (
  eventId: string,
  callback: (checkIn: LuckCheckIn) => void
) => {
  const channel = supabase
    .channel(`luck_check_ins_${eventId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'luck_check_ins',
        filter: `event_id=eq.${eventId}`,
      },
      (payload) => {
        callback(payload.new as LuckCheckIn);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const subscribeToParticipants = (
  eventId: string,
  callback: (participant: LuckParticipant) => void
) => {
  const channel = supabase
    .channel(`luck_participants_${eventId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'luck_participants',
        filter: `event_id=eq.${eventId}`,
      },
      (payload) => callback(payload.new as LuckParticipant)
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
};

// ============================================
// 抽奖多端实时同频广播与事件订阅
// ============================================

export type LotteryBroadcastAction =
  | { type: 'DRAW_START'; prizeId: string; batchSize: number; seq?: number }
  | { type: 'DRAW_STOP'; prizeId: string; winners: { id: string; name: string; dept?: string; avatar?: string }[]; remainingSlots?: number; seq?: number }
  | { type: 'PRIZE_CHANGE'; prizeId: string; seq?: number }
  | { type: 'RESET_DISPLAY'; seq?: number };

export interface LotterySyncCallbacks {
  onBroadcast?: (action: LotteryBroadcastAction) => void;
  onWinnerInsert?: (winner: LuckWinner) => void;
  onWinnerDelete?: (winner: Partial<LuckWinner> & { id: string }) => void;
  onPrizeUpdate?: (prize: LuckPrize) => void;
}

const getLotteryChannelTopic = (eventId: string) => `lottery_sync_${eventId}`;

let sharedLotteryChannel: ReturnType<typeof supabase.channel> | null = null;
let sharedLotteryEventId: string | null = null;
let lastBroadcastSeq = 0;

const nextBroadcastSeq = (): number => {
  const now = Date.now();
  lastBroadcastSeq = now > lastBroadcastSeq ? now : lastBroadcastSeq + 1;
  return lastBroadcastSeq;
};

export const getOrCreateLotterySyncChannel = (eventId: string) => {
  if (sharedLotteryChannel && sharedLotteryEventId === eventId) {
    return sharedLotteryChannel;
  }
  if (sharedLotteryChannel) {
    void supabase.removeChannel(sharedLotteryChannel);
  }
  sharedLotteryEventId = eventId;
  sharedLotteryChannel = supabase.channel(getLotteryChannelTopic(eventId), {
    config: {
      broadcast: { ack: true, self: false },
    },
  });
  return sharedLotteryChannel;
};

/**
 * 将抽奖舞台实时状态持久化到 luck_events.settings.liveLotteryState（供 HTTP 反向代理轮询双通道同步）
 */
export const persistLiveLotteryState = async (
  eventId: string,
  action: LotteryBroadcastAction
): Promise<void> => {
  if (!eventId) return;
  try {
    const { data: current, error: readError } = await supabase
      .from('luck_events')
      .select('settings')
      .eq('id', eventId)
      .single();

    if (readError) return;

    const currentSettings = (current?.settings as Record<string, unknown>) || {};
    await supabase
      .from('luck_events')
      .update({
        settings: {
          ...currentSettings,
          liveLotteryState: action,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', eventId);
  } catch {
    // 忽略非管理员或网络瞬断异常
  }
};

/**
 * 通过 HTTP（走 /supabase-api 同源反向代理）读取最新抽奖舞台状态
 */
export const getLiveLotteryState = async (
  eventId: string
): Promise<LotteryBroadcastAction | null> => {
  if (!eventId) return null;
  try {
    const { data, error } = await supabase
      .from('luck_events')
      .select('settings')
      .eq('id', eventId)
      .single();

    if (error || !data?.settings) return null;
    const settings = data.settings as Record<string, unknown>;
    const liveState = settings.liveLotteryState as LotteryBroadcastAction | undefined;
    if (!liveState || typeof liveState !== 'object' || !liveState.type) {
      return null;
    }
    return liveState;
  } catch {
    return null;
  }
};

/**
 * 发送抽奖状态广播（WebSocket 实时广播 + HTTP 舞台状态双通道写入）
 */
export const broadcastLotteryEvent = async (
  eventId: string,
  action: LotteryBroadcastAction
) => {
  if (!eventId) return;
  const enrichedAction: LotteryBroadcastAction = {
    ...action,
    seq: action.seq ?? nextBroadcastSeq(),
  };

  // 通道 1：写入 luck_events.settings 供移动网络 HTTP 反向代理秒级同频
  void persistLiveLotteryState(eventId, enrichedAction);

  // 通道 2：WebSocket Realtime 毫秒级广播
  try {
    const channel = getOrCreateLotterySyncChannel(eventId);
    if (channel.state !== 'joined' && channel.state !== 'joining') {
      channel.subscribe();
    }
    await channel.send({
      type: 'broadcast',
      event: 'lottery_action',
      payload: enrichedAction,
    });
  } catch (err) {
    console.error('发送抽奖同步广播失败:', err);
  }
};

/**
 * 订阅抽奖实时同频与数据库事件（供所有客户端调用）
 */
export const subscribeToLotterySync = (
  eventId: string,
  callbacks: LotterySyncCallbacks
) => {
  if (!eventId) return () => {};

  const channel = getOrCreateLotterySyncChannel(eventId);

  channel
    .on(
      'broadcast',
      { event: 'lottery_action' },
      (payload) => {
        if (payload?.payload && callbacks.onBroadcast) {
          callbacks.onBroadcast(payload.payload as LotteryBroadcastAction);
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'luck_winners',
        filter: `event_id=eq.${eventId}`,
      },
      (payload) => {
        if (callbacks.onWinnerInsert) {
          callbacks.onWinnerInsert(payload.new as LuckWinner);
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'luck_winners',
        filter: `event_id=eq.${eventId}`,
      },
      (payload) => {
        if (callbacks.onWinnerDelete) {
          callbacks.onWinnerDelete(payload.old as Partial<LuckWinner> & { id: string });
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'luck_prizes',
        filter: `event_id=eq.${eventId}`,
      },
      (payload) => {
        if (callbacks.onPrizeUpdate) {
          callbacks.onPrizeUpdate(payload.new as LuckPrize);
        }
      }
    );

  channel.subscribe();

  return () => {
    void supabase.removeChannel(channel);
    if (sharedLotteryChannel === channel) {
      sharedLotteryChannel = null;
      sharedLotteryEventId = null;
    }
  };
};

// ============================================
// 参与者查询
// ============================================

export const getParticipants = async (eventId: string): Promise<LuckParticipant[]> => {
  const { data, error } = await supabase
    .from('luck_participants')
    .select('*')
    .eq('event_id', eventId);

  if (error) {
    console.error('获取参与者列表失败:', error);
    return [];
  }
  return data || [];
};

/**
 * 获取已签到的参与者列表（用于抽奖池）
 * 只返回 status='checked_in' 的参与者
 */
export const getCheckedInParticipants = async (eventId: string): Promise<LuckParticipant[]> => {
  const { data, error } = await supabase
    .from('luck_participants')
    .select('*')
    .eq('event_id', eventId)
    .eq('status', 'checked_in');

  if (error) {
    console.error('获取已签到参与者失败:', error);
    return [];
  }
  return data || [];
};

export const findParticipant = async (eventId: string, employeeId: string): Promise<LuckParticipant | null> => {
  const { data, error } = await supabase
    .from('luck_participants')
    .select('*')
    .eq('event_id', eventId)
    .eq('employee_id', employeeId)
    .single();

  if (error) {
    return null;
  }
  return data;
};

// ============================================
// 活动管理
// ============================================

export interface CreateEventParams {
  name: string;
  description?: string;
  event_date: string;
  location_name?: string;
  location_lat?: number;
  location_lng?: number;
  location_radius?: number;
  require_location?: boolean;
}

export const createEvent = async (params: CreateEventParams): Promise<LuckEvent | null> => {
  const { data, error } = await supabase
    .from('luck_events')
    .insert({
      name: params.name,
      description: params.description,
      event_date: params.event_date,
      location_name: params.location_name,
      location_lat: params.location_lat,
      location_lng: params.location_lng,
      location_radius: params.location_radius || 500,
      require_location: params.require_location || false,
      status: 'active',
    })
    .select()
    .single();

  if (error) {
    console.error('创建活动失败:', error);
    return null;
  }
  return data;
};

export const updateEvent = async (eventId: string, updates: Partial<CreateEventParams>): Promise<boolean> => {
  const { error } = await supabase
    .from('luck_events')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId);

  if (error) {
    console.error('更新活动失败:', error);
    return false;
  }
  return true;
};

// ============================================
// 参与者管理
// ============================================

export interface ImportParticipant {
  employee_id: string;
  name: string;
  department?: string;
}

/**
 * 批量导入参与者（会先清空该活动的所有旧参与者）
 */
export const importParticipants = async (
  eventId: string, 
  participants: ImportParticipant[]
): Promise<{ success: boolean; count: number; error?: string }> => {
  try {
    // 1. 清空该活动的所有旧参与者
    const { error: deleteError } = await supabase
      .from('luck_participants')
      .delete()
      .eq('event_id', eventId);

    if (deleteError) {
      console.error('清空旧参与者失败:', deleteError);
      return { success: false, count: 0, error: '清空旧名单失败' };
    }

    // 2. 批量插入新参与者
    const insertData = participants.map(p => ({
      event_id: eventId,
      employee_id: p.employee_id.toUpperCase(),
      name: p.name,
      department: p.department || null,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.employee_id}`,
      status: 'pending',
    }));

    const { error: insertError } = await supabase
      .from('luck_participants')
      .insert(insertData);

    if (insertError) {
      console.error('导入参与者失败:', insertError);
      return { success: false, count: 0, error: '导入名单失败' };
    }

    return { success: true, count: participants.length };
  } catch (err) {
    console.error('导入参与者异常:', err);
    return { success: false, count: 0, error: '导入过程发生错误' };
  }
};

/**
 * 添加单个参与者（追加模式）
 */
export const addParticipant = async (
  eventId: string,
  participant: ImportParticipant
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('luck_participants')
      .insert({
        event_id: eventId,
        employee_id: participant.employee_id.toUpperCase(),
        name: participant.name,
        department: participant.department || null,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${participant.employee_id}`,
        status: 'pending',
      });

    if (error) {
      console.error('添加参与者失败:', error);
      return { success: false, error: '添加成员失败' };
    }

    return { success: true };
  } catch (err) {
    console.error('添加参与者异常:', err);
    return { success: false, error: '添加过程发生错误' };
  }
};

/**
 * 获取参与者数量
 */
export const getParticipantCount = async (eventId: string): Promise<number> => {
  const { count, error } = await supabase
    .from('luck_participants')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId);

  if (error) {
    console.error('获取参与者数量失败:', error);
    return 0;
  }
  return count || 0;
};

/**
 * 清空活动的所有签到记录并重置参与者签到状态为 pending
 */
export const resetCheckInStatusForEvent = async (eventId: string): Promise<boolean> => {
  try {
    // 1. 清空签到记录
    const { error: checkInError } = await supabase
      .from('luck_check_ins')
      .delete()
      .eq('event_id', eventId);

    if (checkInError) {
      console.error('清空签到记录失败:', checkInError);
      return false;
    }

    // 2. 将参与者状态重置为 pending（未签到）
    const { error: participantError } = await supabase
      .from('luck_participants')
      .update({
        status: 'pending',
        check_in_time: null,
      })
      .eq('event_id', eventId);

    if (participantError) {
      console.error('重置参与者状态失败:', participantError);
      // 部分旧表可能没有 check_in_time 列，降级仅更新 status
      await supabase
        .from('luck_participants')
        .update({ status: 'pending' })
        .eq('event_id', eventId);
    }

    return true;
  } catch (err) {
    console.error('重置签到状态异常:', err);
    return false;
  }
};

/**
 * 清空活动的所有签到记录（兼容旧接口）
 */
export const clearCheckInRecordsForEvent = async (eventId: string): Promise<boolean> => {
  return resetCheckInStatusForEvent(eventId);
};

/**
 * 清空活动的所有参会人员及签到数据
 */
export const clearAllParticipantsForEvent = async (eventId: string): Promise<boolean> => {
  try {
    await supabase.from('luck_check_ins').delete().eq('event_id', eventId);
    const { error } = await supabase.from('luck_participants').delete().eq('event_id', eventId);
    if (error) {
      console.error('清空参会人员失败:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('清空参会人员异常:', err);
    return false;
  }
};

/**
 * 初始化默认标准演示名单并直接完成签到入场
 * 1. 优先调用后端 RPC 函数 init_demo_participants（安全、原子事务、绕过前端 RLS 限制）
 * 2. 自动生成 30 位已签到参与者与 luck_check_ins 签到流水
 * 3. 签到大屏与抽奖大屏即可直接使用这 30 人进行全流程演示！
 */
export const initDefaultParticipants = async (
  eventId: string,
  count: number = 30,
  prefix: string = 'U'
): Promise<{ success: boolean; count: number; error?: string }> => {
  const cleanPrefix = (prefix || 'U').trim().toUpperCase();

  try {
    const { data, error } = await supabase.rpc('init_demo_participants', {
      p_event_id: eventId,
      p_count: count,
      p_prefix: cleanPrefix,
    });

    if (!error && data && (data as any).success) {
      return { success: true, count: (data as any).count || count };
    }

    if (error) {
      console.error('调用 init_demo_participants RPC 失败:', error);
      return { success: false, count: 0, error: error.message || '生成演示名单失败' };
    }

    return { success: true, count };
  } catch (err: any) {
    console.error('初始化演示名单异常:', err);
    return { success: false, count: 0, error: err?.message || '初始化过程发生错误' };
  }
};

// ============================================
// 签到会话管理
// ============================================

/**
 * 开始签到会话
 * @param eventId 活动ID
 * @param durationMinutes 签到时长（分钟），0 表示无限时
 */
export const startCheckInSession = async (
  eventId: string,
  durationMinutes: number = 0
): Promise<{ success: boolean; endTime?: string; error?: string }> => {
  const startTime = new Date().toISOString();
  let endTime: string | null = null;
  
  if (durationMinutes > 0) {
    const end = new Date(Date.now() + durationMinutes * 60 * 1000);
    endTime = end.toISOString();
  }
  
  const { error } = await supabase
    .from('luck_events')
    .update({
      checkin_open: true,
      checkin_start_time: startTime,
      checkin_end_time: endTime,
      checkin_duration: durationMinutes > 0 ? durationMinutes : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId);

  if (error) {
    console.error('开始签到失败:', error);
    return { success: false, error: '开始签到失败' };
  }
  
  return { success: true, endTime: endTime || undefined };
};

/**
 * 结束签到会话
 */
export const endCheckInSession = async (eventId: string): Promise<boolean> => {
  const { error } = await supabase
    .from('luck_events')
    .update({
      checkin_open: false,
      checkin_end_time: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId);

  if (error) {
    console.error('结束签到失败:', error);
    return false;
  }
  return true;
};

/**
 * 获取签到会话状态
 */
export const getCheckInSessionStatus = async (eventId: string): Promise<{
  isOpen: boolean;
  startTime?: string;
  endTime?: string;
  remainingSeconds?: number;
}> => {
  const { data, error } = await supabase
    .from('luck_events')
    .select('checkin_open, checkin_start_time, checkin_end_time, checkin_duration')
    .eq('id', eventId)
    .single();

  if (error || !data) {
    return { isOpen: false };
  }

  const isOpen = data.checkin_open === true;
  
  // 检查是否已过期
  if (isOpen && data.checkin_end_time) {
    const endTime = new Date(data.checkin_end_time);
    const now = new Date();
    
    if (now >= endTime) {
      // 已过期，自动关闭
      await endCheckInSession(eventId);
      return { isOpen: false, startTime: data.checkin_start_time, endTime: data.checkin_end_time };
    }
    
    const remainingSeconds = Math.floor((endTime.getTime() - now.getTime()) / 1000);
    return {
      isOpen: true,
      startTime: data.checkin_start_time,
      endTime: data.checkin_end_time,
      remainingSeconds,
    };
  }

  return {
    isOpen,
    startTime: data.checkin_start_time || undefined,
    endTime: data.checkin_end_time || undefined,
  };
};

/**
 * 检查签到是否开放（用于签到页面）
 */
export const isCheckInOpen = async (eventId: string): Promise<{ open: boolean; message?: string }> => {
  const status = await getCheckInSessionStatus(eventId);
  
  if (!status.isOpen) {
    return { open: false, message: '签到尚未开始或已结束' };
  }
  
  return { open: true };
};

// ============================================
// 用户管理
// ============================================

/**
 * 获取或创建用户
 */
export const getOrCreateUser = async (authUser: { id: string; email: string; name?: string }): Promise<LuckUser | null> => {
  // 先查找是否存在
  const { data: existingUser } = await supabase
    .from('luck_users')
    .select('*')
    .eq('auth_id', authUser.id)
    .single();

  if (existingUser) {
    return existingUser as LuckUser;
  }

  // 创建新用户
  const { data: newUser, error } = await supabase
    .from('luck_users')
    .insert({
      auth_id: authUser.id,
      email: authUser.email,
      name: authUser.name || authUser.email.split('@')[0],
    })
    .select()
    .single();

  if (error) {
    console.error('创建用户失败:', error);
    return null;
  }

  return newUser as LuckUser;
};

/**
 * 获取当前用户信息
 */
export const getCurrentUser = async (): Promise<LuckUser | null> => {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return null;

  const { data } = await supabase
    .from('luck_users')
    .select('*')
    .eq('auth_id', authUser.id)
    .single();

  return data as LuckUser | null;
};

/**
 * 检查当前登录用户是否为指定活动的管理员/所有者
 */
export const checkIsEventAdmin = async (eventId: string): Promise<boolean> => {
  if (!eventId) return false;
  try {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return false;

    // 获取当前活动信息
    const { data: event, error } = await supabase
      .from('luck_events')
      .select('owner_id')
      .eq('id', eventId)
      .maybeSingle();

    if (error || !event) return false;

    // 1. 如果 event.owner_id 直接与 auth.users 的 id 一致
    if (event.owner_id === authUser.id) {
      return true;
    }

    // 2. 检查 luck_users 表中的对应关联记录或 admin 角色
    const { data: luckUser } = await supabase
      .from('luck_users')
      .select('id, role')
      .eq('auth_id', authUser.id)
      .maybeSingle();

    if (luckUser) {
      if (luckUser.role === 'admin' || luckUser.id === event.owner_id) {
        return true;
      }
    }

    return false;
  } catch (err) {
    console.error('检查管理员权限失败:', err);
    return false;
  }
};

// ============================================
// 项目管理
// ============================================

/**
 * 获取用户的所有项目
 */
export const getUserProjects = async (userId: string): Promise<LuckEvent[]> => {
  const { data, error } = await supabase
    .from('luck_events')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('获取项目列表失败:', error);
    return [];
  }

  return data as LuckEvent[];
};

/**
 * 创建新项目
 */
export const createProject = async (
  ownerId: string,
  data: { name: string; description?: string; event_date?: string; cover_image?: string; mode?: 'wheel' | 'rolling' }
): Promise<LuckEvent | null> => {
  const mode = data.mode || 'wheel';

  const { data: project, error } = await supabase
    .from('luck_events')
    .insert({
      owner_id: ownerId,
      name: data.name,
      description: data.description || null,
      event_date: data.event_date || new Date().toISOString().split('T')[0],
      cover_image: data.cover_image || null,
      mode,
      status: 'draft',
    })
    .select()
    .single();

  if (error) {
    console.error('创建项目失败:', error);
    return null;
  }

  // 自动初始化默认奖品
  if (mode === 'wheel' && project) {
    const defaultPrizes = [
      { name: '一等奖', description: 'Smartphone', quantity: 1, remaining: 1, sort_order: 1 },
      { name: '二等奖', description: 'Headphones', quantity: 3, remaining: 3, sort_order: 2 },
      { name: '三等奖', description: 'ShoppingBag', quantity: 5, remaining: 5, sort_order: 3 },
      { name: '幸运奖', description: 'Coffee', quantity: 20, remaining: 20, sort_order: 4 },
    ];

    await supabase
      .from('luck_prizes')
      .insert(defaultPrizes.map(p => ({
        event_id: project.id,
        ...p,
        is_active: true,
      })));
  } else if (mode === 'rolling' && project) {
    await initDefaultRollingPrizes(project.id);
  }

  return project as LuckEvent;
};

/**
 * 为轮动抽奖项目初始化默认奖项（支持 UUID 主键）
 */
export const initDefaultRollingPrizes = async (eventId: string): Promise<LuckPrize[]> => {
  const defaultRollingPrizes = [
    { name: '特等奖', description: 'Future Car Model S', quantity: 1, remaining: 1, sort_order: 1, image: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=600&q=80' },
    { name: '一等奖', description: 'MacBook Pro M3', quantity: 2, remaining: 2, sort_order: 2, image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80' },
    { name: '二等奖', description: 'iPhone 15 Pro Max', quantity: 5, remaining: 5, sort_order: 3, image: 'https://images.unsplash.com/photo-1696446701796-da61225697cc?auto=format&fit=crop&w=600&q=80' },
    { name: '三等奖', description: 'Keep Gift Card', quantity: 10, remaining: 10, sort_order: 4, image: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=600&q=80' },
  ];

  const { data, error } = await supabase
    .from('luck_prizes')
    .insert(defaultRollingPrizes.map(p => ({
      event_id: eventId,
      ...p,
      is_active: true,
    })))
    .select();

  if (error) {
    console.error('初始化轮动默认奖品失败:', error);
    return [];
  }

  return (data || []) as LuckPrize[];
};

/**
 * 更新项目
 */
export const updateProject = async (
  projectId: string,
  data: Partial<LuckEvent>
): Promise<boolean> => {
  const { error } = await supabase
    .from('luck_events')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', projectId);

  if (error) {
    console.error('更新项目失败:', error);
    return false;
  }

  return true;
};

/**
 * 删除项目
 */
export const deleteProject = async (projectId: string): Promise<boolean> => {
  const { error } = await supabase
    .from('luck_events')
    .delete()
    .eq('id', projectId);

  if (error) {
    console.error('删除项目失败:', error);
    return false;
  }

  return true;
};

// ============================================
// 奖项管理
// ============================================

/**
 * 获取项目的所有奖项
 */
export const getPrizes = async (eventId: string): Promise<LuckPrize[]> => {
  const { data, error } = await supabase
    .from('luck_prizes')
    .select('*')
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('获取奖项列表失败:', error);
    return [];
  }

  return data as LuckPrize[];
};

/**
 * 创建奖项
 */
export const createPrize = async (
  eventId: string,
  data: { name: string; name_en?: string | null; description?: string; image?: string; quantity?: number; sort_order?: number }
): Promise<LuckPrize | null> => {
  const quantity = data.quantity || 1;
  const { data: prize, error } = await supabase
    .from('luck_prizes')
    .insert({
      event_id: eventId,
      name: data.name,
      name_en: data.name_en || null,
      description: data.description || null,
      image: data.image || null,
      quantity,
      remaining: quantity,
      sort_order: data.sort_order || 0,
    })
    .select()
    .single();

  if (error) {
    console.error('创建奖项失败:', error);
    return null;
  }

  return prize as LuckPrize;
};

/**
 * 更新奖项
 */
export const updatePrize = async (
  prizeId: string,
  data: Partial<LuckPrize>
): Promise<boolean> => {
  const { error } = await supabase
    .from('luck_prizes')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', prizeId);

  if (error) {
    console.error('更新奖项失败:', error);
    return false;
  }

  return true;
};

/**
 * 删除奖项
 */
export const deletePrize = async (prizeId: string): Promise<boolean> => {
  const { error } = await supabase
    .from('luck_prizes')
    .delete()
    .eq('id', prizeId);

  if (error) {
    console.error('删除奖项失败:', error);
    return false;
  }

  return true;
};

/**
 * 将前端奖项列表同步至 Supabase luck_prizes 表
 * 保持 sort_order 顺序、更新已有奖项、新增奖项、删除多余奖项
 */
export const syncEventPrizes = async (
  eventId: string,
  prizes: Array<{
    id: string;
    name: string;
    description?: string;
    image?: string;
    count: number;
    drawn: number;
  }>
): Promise<LuckPrize[]> => {
  if (!eventId) return [];

  try {
    const dbPrizes = await getPrizes(eventId);
    const dbPrizeMap = new Map(dbPrizes.map(p => [p.id, p]));
    const targetPrizeIds = new Set<string>();

    for (let index = 0; index < prizes.length; index++) {
      const prize = prizes[index];
      const existing = dbPrizeMap.get(prize.id);
      const remaining = Math.max(0, prize.count - (prize.drawn || 0));

      if (existing) {
        targetPrizeIds.add(existing.id);
        await updatePrize(existing.id, {
          name: prize.name,
          description: prize.description || null,
          image: prize.image || null,
          quantity: prize.count,
          remaining,
          sort_order: index,
        });
      } else {
        const created = await createPrize(eventId, {
          name: prize.name,
          description: prize.description,
          image: prize.image,
          quantity: prize.count,
          sort_order: index,
        });
        if (created) {
          targetPrizeIds.add(created.id);
        }
      }
    }

    // 删除多余奖项
    for (const dbPrize of dbPrizes) {
      if (!targetPrizeIds.has(dbPrize.id)) {
        await deletePrize(dbPrize.id);
      }
    }

    return await getPrizes(eventId);
  } catch (error) {
    console.error('同步活动奖项配置失败:', error);
    return await getPrizes(eventId);
  }
};

// ============================================
// 中奖记录管理
// ============================================

/**
 * 获取项目的中奖记录
 */
export const getWinners = async (eventId: string): Promise<LuckWinner[]> => {
  const { data, error } = await supabase
    .from('luck_winners')
    .select('*, prize:luck_prizes(*)')
    .eq('event_id', eventId)
    .order('won_at', { ascending: false });

  if (error) {
    console.error('获取中奖记录失败:', error);
    return [];
  }

  return data as LuckWinner[];
};

export const drawRollingWinners = async (
  eventId: string,
  prizeId: string,
  count: number
): Promise<{ success: boolean; data?: LuckWinner[]; error?: string }> => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!eventId || !uuidRegex.test(eventId)) {
    return { success: false, error: '活动 ID 格式无效，请检查链接' };
  }
  if (!prizeId || !uuidRegex.test(prizeId)) {
    return { success: false, error: '当前奖项未同步至云端或奖项 ID 无效，请在活动设置中保存并刷新奖项' };
  }
  if (!count || count < 1 || count > 50) {
    return { success: false, error: '单次抽取人数须在 1 到 50 人之间' };
  }

  const { data, error } = await supabase.rpc('draw_rolling_winners', {
    p_event_id: eventId,
    p_prize_id: prizeId,
    p_count: count,
  });

  if (error) {
    console.error('轮动抽奖失败:', error);
    const messages: Record<string, string> = {
      EVENT_OWNER_REQUIRED: '当前账号无权操作此活动（需使用活动创建者账号登录）',
      ROLLING_EVENT_REQUIRED: '该活动不是轮动抽奖模式',
      PRIZE_NOT_FOUND: '奖项不存在或已被停用',
      INSUFFICIENT_PRIZE_REMAINING: '奖项剩余名额不足',
      INSUFFICIENT_ELIGIBLE_PARTICIPANTS: '抽奖池可用人数不足，请先确认参会人员完成签到',
      INVALID_DRAW_COUNT: '单次抽取人数须在 1 到 50 之间',
      EVENT_NOT_FOUND: '未找到该活动，可能已被删除',
      'invalid input syntax for type uuid': '奖项数据异常（无效的奖项ID），请重新配置并保存奖项',
      'permission denied': '权限不足或未登录管理员账号，请先登录',
      'JWT': '登录会话已过期，请重新登录后再试',
      'P0002': '查询不到指定的活动或奖项',
      '42501': '权限校验失败，仅活动管理员可操作开奖',
    };
    const errMsg = error.message || '';
    const knownError = Object.entries(messages).find(([code]) => errMsg.includes(code));
    return {
      success: false,
      error: knownError?.[1] || (errMsg ? `开奖失败: ${errMsg}` : '开奖失败，请检查网络后重试'),
    };
  }

  return { success: true, data: (data || []) as LuckWinner[] };
};

export const drawPersonalWheel = async (
  eventId: string,
  checkInId: string
): Promise<{ success: boolean; data?: LuckWinner; error?: string }> => {
  const { data, error } = await supabase
    .rpc('draw_personal_wheel', {
      p_event_id: eventId,
      p_check_in_id: checkInId,
    })
    .single();

  if (error) {
    console.error('个人转盘抽奖失败:', error);
    const message = error.message.includes('PRIZE_UNAVAILABLE')
      ? '当前奖池已空'
      : '抽奖失败，请重试';
    return { success: false, error: message };
  }

  return { success: true, data: data as LuckWinner };
};

/**
 * 创建中奖记录
 */
export const createWinner = async (
  eventId: string,
  prizeId: string,
  winner: { participant_id?: string; employee_id: string; name: string; department?: string; avatar?: string }
): Promise<LuckWinner | null> => {
  // 开始事务：创建记录 + 减少奖项剩余数量
  const { data: record, error: recordError } = await supabase
    .from('luck_winners')
    .insert({
      event_id: eventId,
      prize_id: prizeId,
      participant_id: winner.participant_id || null,
      employee_id: winner.employee_id,
      name: winner.name,
      department: winner.department || null,
      avatar: winner.avatar || null,
    })
    .select()
    .single();

  if (recordError) {
    console.error('创建中奖记录失败:', recordError);
    return null;
  }

  // 减少奖项剩余数量
  await supabase.rpc('decrement_prize_remaining', { prize_id: prizeId });

  return record as LuckWinner;
};

/**
 * 删除中奖记录
 */
export const deleteWinner = async (winnerId: string, prizeId: string): Promise<boolean> => {
  const { error } = await supabase
    .from('luck_winners')
    .delete()
    .eq('id', winnerId);

  if (error) {
    console.error('删除中奖记录失败:', error);
    return false;
  }

  // 恢复奖项剩余数量
  await supabase.rpc('increment_prize_remaining', { prize_id: prizeId });

  return true;
};

/**
 * 获取项目统计数据
 */
export const getProjectStats = async (eventId: string): Promise<{
  participantCount: number;
  checkedInCount: number;
  prizeCount: number;
  winnerCount: number;
}> => {
  const [participants, checkIns, prizes, winners] = await Promise.all([
    supabase.from('luck_participants').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
    supabase.from('luck_check_ins').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
    supabase.from('luck_prizes').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
    supabase.from('luck_winners').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
  ]);

  return {
    participantCount: participants.count || 0,
    checkedInCount: checkIns.count || 0,
    prizeCount: prizes.count || 0,
    winnerCount: winners.count || 0,
  };
};

// ============================================
// 转盘抽奖专用 API
// ============================================

/**
 * 生成唯一核销码
 */
const generateRedeemCode = (): string => {
  const prefix = 'ISLE' + new Date().getFullYear();
  const random = Math.floor(10000000 + Math.random() * 90000000);
  return `${prefix}-${random}`;
};

/**
 * 转盘抽奖：原子操作 - 检查库存 + 扣减 + 记录中奖
 */
export const wheelDraw = async (
  eventId: string,
  prizeId: string,
  user: Record<string, string>
): Promise<{ success: boolean; winner?: LuckWinner; error?: string }> => {
  // 1. 检查库存
  const { data: prize } = await supabase
    .from('luck_prizes')
    .select('remaining')
    .eq('id', prizeId)
    .single();

  if (!prize || prize.remaining <= 0) {
    return { success: false, error: '该奖品库存已空' };
  }

  // 2. 扣减库存
  const { error: decrError } = await supabase.rpc('decrement_prize_remaining', { prize_id: prizeId });
  if (decrError) {
    console.error('扣减库存失败:', decrError);
    return { success: false, error: '系统繁忙，请重试' };
  }

  // 3. 分离已知列 vs 额外字段
  const knownKeys = ['name', 'phone', 'company', 'department', 'employee_id'];
  const extraInfo: Record<string, string> = {};
  for (const [k, v] of Object.entries(user)) {
    if (!knownKeys.includes(k) && v) extraInfo[k] = v;
  }

  // 4. 写入中奖记录
  const redeemCode = generateRedeemCode();
  const { data: winner, error: winError } = await supabase
    .from('luck_winners')
    .insert({
      event_id: eventId,
      prize_id: prizeId,
      employee_id: user.employee_id || user.phone, // 用工号或手机号作为唯一标识
      name: user.name,
      phone: user.phone,
      company: user.company || null,
      department: user.department || null,
      redeem_code: redeemCode,
      status: 'pending',
      extra_info: Object.keys(extraInfo).length > 0 ? extraInfo : null,
    })
    .select('*, prize:luck_prizes(*)')
    .single();

  if (winError) {
    console.error('写入中奖记录失败:', winError);
    // 回滚库存
    await supabase.rpc('increment_prize_remaining', { prize_id: prizeId });
    return { success: false, error: '记录失败，请重试' };
  }

  return { success: true, winner: winner as LuckWinner };
};

/**
 * 核销中奖记录（按 ID）
 */
export const redeemWinner = async (winnerId: string): Promise<boolean> => {
  const { error } = await supabase
    .from('luck_winners')
    .update({
      status: 'redeemed',
      redeemed_at: new Date().toISOString(),
    })
    .eq('id', winnerId);

  if (error) {
    console.error('核销失败:', error);
    return false;
  }
  return true;
};

/**
 * 按兑换码核销
 */
export const redeemByCode = async (
  eventId: string,
  code: string
): Promise<{ success: boolean; winner?: LuckWinner; error?: string }> => {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return { success: false, error: '请输入兑换码' };

  // 查找匹配的中奖记录
  const { data, error: fetchError } = await supabase
    .from('luck_winners')
    .select('*, prize:luck_prizes(*)')
    .eq('event_id', eventId)
    .eq('redeem_code', trimmed)
    .single();

  if (fetchError || !data) {
    return { success: false, error: '未找到匹配的兑换码，请检查输入' };
  }

  if (data.status === 'redeemed') {
    return { success: false, error: `该奖品已于 ${new Date(data.redeemed_at).toLocaleString('zh-CN')} 核销` };
  }

  // 执行核销
  const { error: updateError } = await supabase
    .from('luck_winners')
    .update({ status: 'redeemed', redeemed_at: new Date().toISOString() })
    .eq('id', data.id);

  if (updateError) {
    return { success: false, error: '核销操作失败，请重试' };
  }

  return { success: true, winner: { ...data, status: 'redeemed' } as LuckWinner };
};

/**
 * 按兑换码查询中奖记录（仅查询，不核销）
 */
export const lookupByCode = async (
  eventId: string,
  code: string
): Promise<{ found: boolean; winner?: LuckWinner; error?: string }> => {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return { found: false, error: '请输入兑换码' };

  const { data, error } = await supabase
    .from('luck_winners')
    .select('*, prize:luck_prizes(*)')
    .eq('event_id', eventId)
    .eq('redeem_code', trimmed)
    .single();

  if (error || !data) {
    return { found: false, error: '未找到匹配的兑换码' };
  }

  return { found: true, winner: data as LuckWinner };
};

/**
 * 检查手机号是否已在本活动中抽过奖
 */
export const checkPhoneDuplicate = async (eventId: string, phone: string): Promise<boolean> => {
  const { count } = await supabase
    .from('luck_winners')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('phone', phone);

  return (count || 0) > 0;
};

/**
 * 获取中奖记录（含奖品信息，管理端用）
 */
export const getWinnersWithPrizes = async (eventId: string): Promise<LuckWinner[]> => {
  const { data, error } = await supabase
    .from('luck_winners')
    .select('*, prize:luck_prizes(*)')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('获取中奖记录失败:', error);
    return [];
  }
  return (data || []) as LuckWinner[];
};

/**
 * 获取转盘抽奖阶段统计
 */
export const getWheelStats = async (eventId: string): Promise<{
  totalWinners: number;
  redeemedCount: number;
  remainingPrizes: number;
}> => {
  const [winners, redeemed, prizes] = await Promise.all([
    supabase.from('luck_winners').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
    supabase.from('luck_winners').select('id', { count: 'exact', head: true }).eq('event_id', eventId).eq('status', 'redeemed'),
    supabase.from('luck_prizes').select('remaining').eq('event_id', eventId).eq('is_active', true),
  ]);

  const remainingPrizes = (prizes.data || []).reduce((sum: number, p: { remaining: number }) => sum + p.remaining, 0);

  return {
    totalWinners: winners.count || 0,
    redeemedCount: redeemed.count || 0,
    remainingPrizes,
  };
};

/**
 * 撤销中奖记录（恢复奖项库存并删除中奖记录）
 */
export const undoRollingWinner = async (
  eventId: string,
  winnerId: string
): Promise<{ success: boolean; error?: string }> => {
  if (!eventId || !winnerId) {
    return { success: false, error: '缺少活动ID或记录ID' };
  }

  try {
    const { error } = await supabase.rpc('undo_rolling_winner', {
      p_event_id: eventId,
      p_winner_id: winnerId,
    });

    if (error) {
      console.warn('RPC 撤销失败，执行 Client Fallback:', error);
      // Fallback: 客户端直接操作
      const { data: winner } = await supabase
        .from('luck_winners')
        .select('*')
        .eq('id', winnerId)
        .eq('event_id', eventId)
        .maybeSingle();

      if (winner) {
        await supabase.from('luck_winners').delete().eq('id', winnerId);
        if (winner.prize_id) {
          const { data: prize } = await supabase
            .from('luck_prizes')
            .select('quantity, remaining')
            .eq('id', winner.prize_id)
            .maybeSingle();
          if (prize) {
            await supabase
              .from('luck_prizes')
              .update({ remaining: Math.min(prize.quantity, prize.remaining + 1) })
              .eq('id', winner.prize_id);
          }
        }
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error('撤销中奖记录异常:', err);
    return { success: false, error: err.message || '撤销失败' };
  }
};

