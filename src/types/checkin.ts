// ============================================
// 签到系统类型定义
// ============================================

/**
 * 活动/场次
 */
export interface CheckInEvent {
  id: string;
  name: string;
  description?: string;
  eventDate: string;
  eventTimeStart?: string;
  eventTimeEnd?: string;
  
  // 位置设置
  locationName?: string;
  locationLat?: number;
  locationLng?: number;
  locationRadius?: number; // 有效签到半径(米)
  requireLocation: boolean;
  
  // 状态
  status: 'draft' | 'active' | 'completed';
  totalParticipants: number;
  
  createdAt: string;
}

/**
 * 参与者
 */
export interface Participant {
  id: string;
  eventId: string;
  employeeId: string;  // 工号 (企业微信 UserId)
  name: string;
  department?: string;
  avatar?: string;
  mobile?: string;
  email?: string;
  status: 'pending' | 'checked_in';
  checkInId?: string;
  createdAt: string;
}

/**
 * 签到记录
 */
export interface CheckInRecord {
  id: string;
  eventId: string;
  participantId?: string;
  
  // 员工信息
  employeeId: string;
  name: string;
  department?: string;
  avatar?: string;
  
  // 签到信息
  checkInTime: string;
  
  // 位置信息
  locationLat?: number;
  locationLng?: number;
  locationAccuracy?: number;
  locationValid?: boolean;
  locationDistance?: number;
  
  // 设备信息
  deviceInfo?: DeviceInfo;
  ipAddress?: string;
  
  // 签到方式
  checkInMethod: 'qrcode' | 'manual';
  
  createdAt: string;
}

/**
 * 设备信息
 */
export interface DeviceInfo {
  platform?: string;
  browser?: string;
  userAgent?: string;
}

/**
 * 企业微信用户信息
 */
export interface WeComUserInfo {
  employeeId: string;  // UserId
  name: string;
  department?: string;
  avatar?: string;
  gender?: string;
  mobile?: string;
  email?: string;
}

/**
 * 位置信息
 */
export interface LocationInfo {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp?: number;
}

/**
 * 签到统计
 */
export interface CheckInStats {
  eventId: string;
  eventName: string;
  totalParticipants: number;
  checkedInCount: number;
  checkInPercentage: number;
  lastCheckInTime?: string;
  departmentStats?: DepartmentStat[];
}

/**
 * 部门统计
 */
export interface DepartmentStat {
  department: string;
  total: number;
  checkedIn: number;
  percentage: number;
}

/**
 * 签到设置 (本地存储)
 */
export interface CheckInSettings {
  // 活动配置
  eventName: string;
  eventDate: string;
  
  // 位置配置
  requireLocation: boolean;
  locationName?: string;
  locationLat?: number;
  locationLng?: number;
  locationRadius?: number;
  
  // 大屏配置
  showQRCode: boolean;
  qrCodeSize: 'small' | 'medium' | 'large';
  animationStyle: 'slide' | 'fade' | 'bounce';
  showDepartmentStats: boolean;
  autoPlayInterval: number; // 自动滚动间隔(秒)
  
  // 其他配置
  allowLateCheckIn: boolean;
  showCheckInHistory: boolean;
  maxDisplayCount: number;
}

/**
 * 默认签到设置
 */
export const DEFAULT_CHECKIN_SETTINGS: CheckInSettings = {
  eventName: '2026年度盛典',
  eventDate: new Date().toISOString().split('T')[0],
  requireLocation: false,
  showQRCode: true,
  qrCodeSize: 'medium',
  animationStyle: 'slide',
  showDepartmentStats: true,
  autoPlayInterval: 5,
  allowLateCheckIn: true,
  showCheckInHistory: true,
  maxDisplayCount: 50,
};

/**
 * 签到页面状态
 */
export type CheckInPageState = 
  | 'loading'        // 加载中
  | 'show_qrcode'    // 显示二维码（非企业微信环境）
  | 'authorizing'    // 正在授权
  | 'auth_failed'    // 授权失败
  | 'get_location'   // 获取位置中
  | 'confirm'        // 确认签到
  | 'checking_in'    // 签到中
  | 'success'        // 签到成功
  | 'already_checked' // 已签到
  | 'error';         // 错误

/**
 * 模拟签到数据 (开发用)
 */
export const MOCK_CHECK_IN_RECORDS: CheckInRecord[] = [
  {
    id: 'mock_1',
    eventId: 'event_1',
    employeeId: 'EMP001',
    name: '张三',
    department: '技术研发中心',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=1',
    checkInTime: new Date(Date.now() - 1000 * 60 * 1).toISOString(),
    checkInMethod: 'qrcode',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'mock_2',
    eventId: 'event_1',
    employeeId: 'EMP002',
    name: '李四',
    department: '全球市场部',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=2',
    checkInTime: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    checkInMethod: 'qrcode',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'mock_3',
    eventId: 'event_1',
    employeeId: 'EMP003',
    name: '王五',
    department: '综合管理部',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=3',
    checkInTime: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    checkInMethod: 'qrcode',
    createdAt: new Date().toISOString(),
  },
];

/**
 * 模拟参与者名单 (开发用)
 */
export const MOCK_PARTICIPANTS: Participant[] = Array.from({ length: 100 }).map((_, i) => ({
  id: `participant_${i + 1}`,
  eventId: 'event_1',
  employeeId: `EMP${String(i + 1).padStart(3, '0')}`,
  name: ['张伟', '王芳', '李娜', '刘洋', '陈静', '杨帆', '赵敏', '周涛', '吴强', '郑欣'][i % 10] + (i > 9 ? i : ''),
  department: ['技术研发中心', '全球市场部', '综合管理部', '财务部', '人力资源部'][i % 5],
  avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${i}`,
  status: i < 30 ? 'checked_in' : 'pending',
  createdAt: new Date().toISOString(),
}));
