import { ThemeId, ThemePalette } from './types';

export type ThemeCategory = 'light' | 'dark' | 'functional';

export interface ThemeOption {
  id: ThemeId;
  name: string;
  description: string;
  category: ThemeCategory;
  palette: ThemePalette;
}

export const DEFAULT_THEME_ID: ThemeId = 'festivalLight';

export const DEFAULT_CUSTOM_THEME: ThemePalette = {
  primary: '#de2910',
  secondary: '#ff3b1f',
  accent: '#ffde00',
  bgBase: '#8f001a',
  bgDeep: '#b31524',
};

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'festivalLight',
    name: '中国红·新春',
    description: '灯笼红搭配福字金，春节氛围最强。',
    category: 'light',
    palette: {
      primary: '#de2910',
      secondary: '#ff3b1f',
      accent: '#ffde00',
      bgBase: '#8f001a',
      bgDeep: '#b31524',
    },
  },
  {
    id: 'champagne',
    name: '福满鎏金',
    description: '宫灯金与朱红，适合颁奖典礼感。',
    category: 'light',
    palette: {
      primary: '#d81e06',
      secondary: '#c21807',
      accent: '#f6c945',
      bgBase: '#7a111f',
      bgDeep: '#a0192b',
    },
  },
  {
    id: 'sunrise',
    name: '烟花绯橙',
    description: '烟花橙红渐变，节庆舞台更亮。',
    category: 'light',
    palette: {
      primary: '#f5222d',
      secondary: '#ff6a00',
      accent: '#ffd666',
      bgBase: '#7a1f16',
      bgDeep: '#b2351e',
    },
  },
  {
    id: 'mint',
    name: '锦鲤珊瑚',
    description: '珊瑚红搭配暖金，更活泼年轻。',
    category: 'light',
    palette: {
      primary: '#ff4d4f',
      secondary: '#ff7a45',
      accent: '#ffd166',
      bgBase: '#7f1d1d',
      bgDeep: '#b02a37',
    },
  },
  {
    id: 'nebula',
    name: '深空紫',
    description: '科技感深色舞台。',
    category: 'dark',
    palette: {
      primary: '#3c80fa',
      secondary: '#573cfa',
      accent: '#b63cfa',
      bgBase: '#0b0a1a',
      bgDeep: '#0f0c29',
    },
  },
  {
    id: 'festival',
    name: '鎏金红夜',
    description: '深红金配色，适合庄重舞台。',
    category: 'dark',
    palette: {
      primary: '#ff6b3d',
      secondary: '#c81e1e',
      accent: '#ffcf5a',
      bgBase: '#1a0404',
      bgDeep: '#2a0505',
    },
  },
  {
    id: 'macos',
    name: 'macOS 冰蓝',
    description: '清透蓝青，偏 Apple 玻璃风格。',
    category: 'dark',
    palette: {
      primary: '#5ac8fa',
      secondary: '#0a84ff',
      accent: '#30d158',
      bgBase: '#040b16',
      bgDeep: '#07121f',
    },
  },
  {
    id: 'clarity',
    name: '高对比清晰',
    description: '强调可读性，适合远距离大屏。',
    category: 'functional',
    palette: {
      primary: '#22d3ee',
      secondary: '#0ea5e9',
      accent: '#f59e0b',
      bgBase: '#020617',
      bgDeep: '#0b1120',
    },
  },
  {
    id: 'custom',
    name: '自定义色盘',
    description: '使用你手动调整的主题配色。',
    category: 'functional',
    palette: DEFAULT_CUSTOM_THEME,
  },
];

const THEME_ID_SET = new Set<ThemeId>(THEME_OPTIONS.map(theme => theme.id));

export const isThemeId = (value: string): value is ThemeId => THEME_ID_SET.has(value as ThemeId);

export const getThemeById = (themeId: ThemeId): ThemeOption => {
  return THEME_OPTIONS.find(theme => theme.id === themeId) || THEME_OPTIONS[0];
};

const hexToRgbTriplet = (hex: string): string => {
  const normalized = hex.replace('#', '').trim();
  const safe = normalized.length === 3
    ? normalized.split('').map(char => `${char}${char}`).join('')
    : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(safe)) {
    return '0 0 0';
  }

  const r = parseInt(safe.slice(0, 2), 16);
  const g = parseInt(safe.slice(2, 4), 16);
  const b = parseInt(safe.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
};

const hexToRgb = (hex: string): [number, number, number] => {
  const normalized = hex.replace('#', '').trim();
  const safe = normalized.length === 3
    ? normalized.split('').map(char => `${char}${char}`).join('')
    : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(safe)) {
    return [0, 0, 0];
  }

  return [
    parseInt(safe.slice(0, 2), 16),
    parseInt(safe.slice(2, 4), 16),
    parseInt(safe.slice(4, 6), 16),
  ];
};

const getRelativeLuminance = (r: number, g: number, b: number): number => {
  const channel = (value: number): number => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

export const paletteToCssVariables = (palette: ThemePalette): Record<string, string> => {
  const [baseR, baseG, baseB] = hexToRgb(palette.bgBase);
  const baseLuminance = getRelativeLuminance(baseR, baseG, baseB);
  const isLightBackground = baseLuminance > 0.48;

  return {
    '--color-primary': palette.primary,
    '--color-secondary': palette.secondary,
    '--color-accent': palette.accent,
    '--color-dark': palette.bgDeep,
    '--color-bg-base': palette.bgBase,
    '--color-bg-deep': palette.bgDeep,
    '--color-primary-rgb': hexToRgbTriplet(palette.primary),
    '--color-secondary-rgb': hexToRgbTriplet(palette.secondary),
    '--color-accent-rgb': hexToRgbTriplet(palette.accent),
    '--color-bg-base-rgb': hexToRgbTriplet(palette.bgBase),
    '--color-bg-deep-rgb': hexToRgbTriplet(palette.bgDeep),
    '--color-text-strong': isLightBackground ? 'rgba(17,24,39,0.96)' : 'rgba(255,255,255,0.96)',
    '--color-text-secondary': isLightBackground ? 'rgba(17,24,39,0.82)' : 'rgba(255,255,255,0.84)',
    '--color-text-muted': isLightBackground ? 'rgba(17,24,39,0.66)' : 'rgba(255,255,255,0.68)',
    '--color-text-soft': isLightBackground ? 'rgba(17,24,39,0.52)' : 'rgba(255,255,255,0.52)',
  };
};
