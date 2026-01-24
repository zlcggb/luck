// ============================================
// Supabase 签到服务
// ============================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

export const getEvent = async (eventId: string = DEFAULT_EVENT_ID): Promise<LuckEvent | null> => {
  const { data, error } = await supabase
    .from('luck_events')
    .select('*')
    .eq('id', eventId)
    .single();
  
  if (error) {
    console.error('获取活动失败:', error);
    return null;
  }
  return data;
};

export const getActiveEvent = async (): Promise<LuckEvent | null> => {
  const { data, error } = await supabase
    .from('luck_events')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (error) {
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

  // 检查是否已签到
  const { data: existing } = await supabase
    .from('luck_check_ins')
    .select('*')
    .eq('event_id', eventId)
    .eq('employee_id', employeeId)
    .single();

  if (existing) {
    return { success: false, error: '您已签到，无需重复签到', data: existing };
  }

  // 创建签到记录
  const { data, error } = await supabase
    .from('luck_check_ins')
    .insert({
      event_id: eventId,
      employee_id: employeeId,
      name,
      department,
      avatar: avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${employeeId}`,
      location_lat: location?.latitude,
      location_lng: location?.longitude,
      location_accuracy: location?.accuracy,
      check_in_method: 'qrcode',
    })
    .select()
    .single();

  if (error) {
    console.error('签到失败:', error);
    return { success: false, error: '签到失败，请重试' };
  }

  return { success: true, data };
};

export const getCheckInByEmployee = async (eventId: string, employeeId: string): Promise<LuckCheckIn | null> => {
  const { data, error } = await supabase
    .from('luck_check_ins')
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
 * 清空活动的所有签到记录
 */
export const clearCheckInRecordsForEvent = async (eventId: string): Promise<boolean> => {
  const { error } = await supabase
    .from('luck_check_ins')
    .delete()
    .eq('event_id', eventId);

  if (error) {
    console.error('清空签到记录失败:', error);
    return false;
  }
  return true;
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
  data: { name: string; description?: string; event_date?: string; cover_image?: string }
): Promise<LuckEvent | null> => {
  const { data: project, error } = await supabase
    .from('luck_events')
    .insert({
      owner_id: ownerId,
      name: data.name,
      description: data.description || null,
      event_date: data.event_date || new Date().toISOString().split('T')[0],
      cover_image: data.cover_image || null,
      status: 'draft',
    })
    .select()
    .single();

  if (error) {
    console.error('创建项目失败:', error);
    return null;
  }

  return project as LuckEvent;
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
  data: { name: string; description?: string; image?: string; quantity?: number; sort_order?: number }
): Promise<LuckPrize | null> => {
  const quantity = data.quantity || 1;
  const { data: prize, error } = await supabase
    .from('luck_prizes')
    .insert({
      event_id: eventId,
      name: data.name,
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
