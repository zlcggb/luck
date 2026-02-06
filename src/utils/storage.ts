import {
  Participant,
  Prize,
  DrawRecord,
  STORAGE_KEYS,
  DEFAULT_PRIZES,
  BackgroundMusicSettings,
  DEFAULT_BACKGROUND_MUSIC,
} from '../types';

// 保存参与者列表
export const saveParticipants = (participants: Participant[]) => {
  localStorage.setItem(STORAGE_KEYS.PARTICIPANTS, JSON.stringify(participants));
};

// 读取参与者列表
export const loadParticipants = (): Participant[] => {
  const data = localStorage.getItem(STORAGE_KEYS.PARTICIPANTS);
  return data ? JSON.parse(data) : [];
};

// 保存奖项配置
export const savePrizes = (prizes: Prize[]) => {
  localStorage.setItem(STORAGE_KEYS.PRIZES, JSON.stringify(prizes));
};

// 读取奖项配置
export const loadPrizes = (): Prize[] => {
  const data = localStorage.getItem(STORAGE_KEYS.PRIZES);
  return data ? JSON.parse(data) : DEFAULT_PRIZES;
};

// 保存抽奖记录
export const saveRecords = (records: DrawRecord[]) => {
  localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(records));
};

// 读取抽奖记录
export const loadRecords = (): DrawRecord[] => {
  const data = localStorage.getItem(STORAGE_KEYS.RECORDS);
  return data ? JSON.parse(data) : [];
};

// 保存已中奖ID集合
export const saveExcludedIds = (ids: Set<string>) => {
  localStorage.setItem(STORAGE_KEYS.EXCLUDED_IDS, JSON.stringify([...ids]));
};

// 读取已中奖ID集合
export const loadExcludedIds = (): Set<string> => {
  const data = localStorage.getItem(STORAGE_KEYS.EXCLUDED_IDS);
  return data ? new Set(JSON.parse(data)) : new Set();
};

// 保存背景音乐配置
export const saveBackgroundMusicSettings = (settings: BackgroundMusicSettings) => {
  localStorage.setItem(STORAGE_KEYS.BACKGROUND_MUSIC, JSON.stringify(settings));
};

// 读取背景音乐配置
export const loadBackgroundMusicSettings = (): BackgroundMusicSettings => {
  const data = localStorage.getItem(STORAGE_KEYS.BACKGROUND_MUSIC);
  if (!data) {
    return DEFAULT_BACKGROUND_MUSIC;
  }
  const parsed = JSON.parse(data) as Partial<BackgroundMusicSettings>;
  return {
    ...DEFAULT_BACKGROUND_MUSIC,
    ...parsed,
  };
};

// 清除所有数据
export const clearAllData = () => {
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
};
