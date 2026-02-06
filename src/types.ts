// 员工/参与者类型
export interface Participant {
  id: string;           // 工号
  name: string;         // 姓名
  dept: string;         // 组织/部门
  avatar?: string;      // 头像URL（可选）
}

// 奖项类型
export interface Prize {
  id: string;           // 奖项ID
  name: string;         // 奖项名称（如：一等奖、二等奖）
  count: number;        // 该奖项名额
  description?: string; // 奖品描述
  image?: string;       // 奖品图片URL
  drawn: number;        // 已抽取数量
}

// 抽奖记录类型
export interface DrawRecord {
  id: string;           // 记录ID
  timestamp: number;    // 时间戳
  prizeId: string;      // 奖项ID
  prizeName: string;    // 奖项名称
  winners: Participant[]; // 中奖者列表
}

export interface BackgroundMusicSettings {
  src: string;
  name: string;
  autoPlayOnDraw: boolean;
  presetId: string;
}

// 完整的抽奖数据状态
export interface LotteryState {
  participants: Participant[];  // 所有参与者
  prizes: Prize[];              // 奖项配置
  records: DrawRecord[];        // 抽奖历史记录
  excludedIds: Set<string>;     // 已中奖的工号集合
}

export const DEFAULT_BACKGROUND_MUSIC: BackgroundMusicSettings = {
  src: '',
  name: '',
  autoPlayOnDraw: true,
  presetId: '',
};

// 默认奖项配置
export const DEFAULT_PRIZES: Prize[] = [
  { id: 'special', name: '特等奖', count: 1, description: 'Future Car Model S', image: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=600&q=80', drawn: 0 },
  { id: 'first', name: '一等奖', count: 2, description: 'MacBook Pro M3', image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80', drawn: 0 },
  { id: 'second', name: '二等奖', count: 5, description: 'iPhone 15 Pro Max', image: 'https://images.unsplash.com/photo-1696446701796-da61225697cc?auto=format&fit=crop&w=600&q=80', drawn: 0 },
  { id: 'third', name: '三等奖', count: 10, description: 'Keep Gift Card', image: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=600&q=80', drawn: 0 },
];

// LocalStorage 键名
export const STORAGE_KEYS = {
  PARTICIPANTS: 'lottery_participants',
  PRIZES: 'lottery_prizes',
  RECORDS: 'lottery_records',
  EXCLUDED_IDS: 'lottery_excluded_ids',
  BACKGROUND_MUSIC: 'lottery_background_music',
};
