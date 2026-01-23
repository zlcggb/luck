// ============================================
// 签到数据本地存储工具
// ============================================

import { 
  CheckInRecord, 
  CheckInSettings, 
  Participant,
  DEFAULT_CHECKIN_SETTINGS 
} from '../types/checkin';

const STORAGE_KEYS = {
  SETTINGS: 'checkin_settings',
  RECORDS: 'checkin_records',
  PARTICIPANTS: 'checkin_participants',
};

// ============================================
// 签到设置
// ============================================

export const saveCheckInSettings = (settings: CheckInSettings): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (error) {
    console.error('保存签到设置失败:', error);
  }
};

export const loadCheckInSettings = (): CheckInSettings => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (data) {
      return { ...DEFAULT_CHECKIN_SETTINGS, ...JSON.parse(data) };
    }
  } catch (error) {
    console.error('加载签到设置失败:', error);
  }
  return DEFAULT_CHECKIN_SETTINGS;
};

// ============================================
// 签到记录
// ============================================

export const saveCheckInRecords = (records: CheckInRecord[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(records));
  } catch (error) {
    console.error('保存签到记录失败:', error);
  }
};

export const loadCheckInRecords = (): CheckInRecord[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.RECORDS);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('加载签到记录失败:', error);
  }
  return [];
};

export const addCheckInRecord = (record: CheckInRecord): CheckInRecord[] => {
  const records = loadCheckInRecords();
  // 检查是否已签到
  const exists = records.find(r => r.employeeId === record.employeeId);
  if (exists) {
    console.warn('该员工已签到:', record.employeeId);
    return records;
  }
  const newRecords = [record, ...records];
  saveCheckInRecords(newRecords);
  return newRecords;
};

export const removeCheckInRecord = (recordId: string): CheckInRecord[] => {
  const records = loadCheckInRecords();
  const newRecords = records.filter(r => r.id !== recordId);
  saveCheckInRecords(newRecords);
  return newRecords;
};

export const isAlreadyCheckedIn = (employeeId: string): boolean => {
  const records = loadCheckInRecords();
  return records.some(r => r.employeeId === employeeId);
};

export const getCheckInRecord = (employeeId: string): CheckInRecord | undefined => {
  const records = loadCheckInRecords();
  return records.find(r => r.employeeId === employeeId);
};

// ============================================
// 参与者名单
// ============================================

export const saveParticipants = (participants: Participant[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.PARTICIPANTS, JSON.stringify(participants));
  } catch (error) {
    console.error('保存参与者名单失败:', error);
  }
};

export const loadParticipants = (): Participant[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PARTICIPANTS);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('加载参与者名单失败:', error);
  }
  return [];
};

export const updateParticipantStatus = (employeeId: string, status: 'pending' | 'checked_in', checkInId?: string): void => {
  const participants = loadParticipants();
  const updated = participants.map(p => 
    p.employeeId === employeeId 
      ? { ...p, status, checkInId } 
      : p
  );
  saveParticipants(updated);
};

// ============================================
// 统计计算
// ============================================

// 从抽奖系统读取参与者总数
const getLotteryParticipants = (): { id: string; name: string; dept: string }[] => {
  try {
    const data = localStorage.getItem('lottery_participants');
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('读取抽奖系统参与者失败:', error);
  }
  return [];
};

export const calculateStats = () => {
  const records = loadCheckInRecords();
  
  // 优先使用抽奖系统的参与者列表作为总人数
  const lotteryParticipants = getLotteryParticipants();
  const checkinParticipants = loadParticipants();
  
  // 如果抽奖系统有参与者，使用抽奖系统的数据；否则使用签到系统的数据
  const participants = lotteryParticipants.length > 0 ? lotteryParticipants : checkinParticipants;
  const totalParticipants = participants.length || 0;
  const checkedInCount = records.length;
  const checkInPercentage = totalParticipants > 0 
    ? Math.round((checkedInCount / totalParticipants) * 100) 
    : 0;
  
  // 按部门统计
  const departmentMap = new Map<string, { total: number; checkedIn: number }>();
  
  // 统计所有参与者的部门
  participants.forEach(p => {
    const dept = (p as any).dept || (p as any).department || '未知部门';
    if (!departmentMap.has(dept)) {
      departmentMap.set(dept, { total: 0, checkedIn: 0 });
    }
    departmentMap.get(dept)!.total++;
  });
  
  // 统计已签到人员的部门
  records.forEach(r => {
    const dept = r.department || '未知部门';
    if (departmentMap.has(dept)) {
      departmentMap.get(dept)!.checkedIn++;
    } else {
      // 如果签到记录的部门不在参与者列表中，单独添加
      departmentMap.set(dept, { total: 1, checkedIn: 1 });
    }
  });
  
  const departmentStats = Array.from(departmentMap.entries()).map(([department, stats]) => ({
    department,
    total: stats.total,
    checkedIn: stats.checkedIn,
    percentage: stats.total > 0 ? Math.round((stats.checkedIn / stats.total) * 100) : 0,
  })).sort((a, b) => b.checkedIn - a.checkedIn);
  
  return {
    totalParticipants,
    checkedInCount,
    checkInPercentage,
    departmentStats,
    lastCheckInTime: records.length > 0 ? records[0].checkInTime : undefined,
  };
};

// ============================================
// 清除数据
// ============================================

export const clearAllCheckInData = (): void => {
  localStorage.removeItem(STORAGE_KEYS.RECORDS);
  localStorage.removeItem(STORAGE_KEYS.PARTICIPANTS);
};

export const clearCheckInRecords = (): void => {
  localStorage.removeItem(STORAGE_KEYS.RECORDS);
  // 同时重置参与者状态
  const participants = loadParticipants();
  const reset = participants.map(p => ({ ...p, status: 'pending' as const, checkInId: undefined }));
  saveParticipants(reset);
};
