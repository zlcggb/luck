import { AvatarThemeId, Participant } from './types';

type AvatarProvider = 'dicebear' | 'ui-avatars' | 'pravatar' | 'robohash' | 'unavatar';

export interface AvatarThemeOption {
  id: AvatarThemeId;
  name: string;
  description: string;
  provider: AvatarProvider;
}

export const DEFAULT_AVATAR_THEME_ID: AvatarThemeId = 'dicebear-avataaars';

export const AVATAR_THEME_OPTIONS: AvatarThemeOption[] = [
  {
    id: 'dicebear-avataaars',
    name: '卡通商务',
    description: '默认商务卡通风，适合年会与企业场景。',
    provider: 'dicebear',
  },
  {
    id: 'dicebear-open-peeps',
    name: '二次元线稿',
    description: '轻二次元人物线稿，亲和感更强。',
    provider: 'dicebear',
  },
  {
    id: 'dicebear-lorelei',
    name: '二次元时尚',
    description: '偏潮流插画的人物头像风格。',
    provider: 'dicebear',
  },
  {
    id: 'dicebear-personas',
    name: '政务证件风',
    description: '简洁证件照质感，适合行政/政务展示。',
    provider: 'dicebear',
  },
  {
    id: 'dicebear-pixel-art',
    name: '像素复古',
    description: '游戏像素风，活动氛围更活跃。',
    provider: 'dicebear',
  },
  {
    id: 'dicebear-bottts',
    name: '机械机器人',
    description: '科技主题机器人头像。',
    provider: 'dicebear',
  },
  {
    id: 'ui-official',
    name: '官方简约',
    description: '纯净首字母头像，加载速度快。',
    provider: 'ui-avatars',
  },
  {
    id: 'ui-military',
    name: '军绿识别牌',
    description: '军绿色徽章风格，适配军旅主题。',
    provider: 'ui-avatars',
  },
  {
    id: 'ui-teacher',
    name: '校园教师',
    description: '蓝色学术风，适配学校与教育活动。',
    provider: 'ui-avatars',
  },
  {
    id: 'pravatar-photo',
    name: '真人照片',
    description: '真实人物照片占位头像。',
    provider: 'pravatar',
  },
  {
    id: 'robohash-heroes',
    name: '英雄怪兽',
    description: 'RoboHash 角色头像，辨识度高。',
    provider: 'robohash',
  },
  {
    id: 'unavatar-social',
    name: '社交头像',
    description: '通过 ID 自动尝试匹配社交平台头像（稳定性受外部平台影响）。',
    provider: 'unavatar',
  },
];

const AVATAR_THEME_ID_SET = new Set<AvatarThemeId>(AVATAR_THEME_OPTIONS.map(theme => theme.id));

const LEGACY_GENERATED_AVATAR_PATTERNS = [
  /api\.dicebear\.com\/7\.x\/avataaars\/svg\?seed=/i,
  /api\.dicebear\.com\/9\.x\/avataaars\/svg\?seed=/i,
];

export const isAvatarThemeId = (value: string): value is AvatarThemeId => {
  return AVATAR_THEME_ID_SET.has(value as AvatarThemeId);
};

const cleanName = (participant: Participant): string => {
  const name = participant.name?.trim();
  if (name) return name;
  return participant.id?.trim() || 'User';
};

const buildSeed = (participant: Participant): string => {
  const base = `${participant.id || ''}-${participant.name || ''}-${participant.dept || ''}`.trim();
  return encodeURIComponent(base || 'participant');
};

const buildUiAvatarUrl = (
  participant: Participant,
  background: string,
  color = 'ffffff',
): string => {
  const name = encodeURIComponent(cleanName(participant));
  return `https://ui-avatars.com/api/?name=${name}&background=${background}&color=${color}&size=256&rounded=true&bold=true&format=svg`;
};

const buildPrimaryAvatarUrl = (participant: Participant, avatarThemeId: AvatarThemeId): string => {
  const seed = buildSeed(participant);

  switch (avatarThemeId) {
    case 'dicebear-avataaars':
      return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
    case 'dicebear-open-peeps':
      return `https://api.dicebear.com/7.x/open-peeps/svg?seed=${seed}`;
    case 'dicebear-lorelei':
      return `https://api.dicebear.com/7.x/lorelei/svg?seed=${seed}`;
    case 'dicebear-personas':
      return `https://api.dicebear.com/7.x/personas/svg?seed=${seed}`;
    case 'dicebear-pixel-art':
      return `https://api.dicebear.com/7.x/pixel-art/svg?seed=${seed}`;
    case 'dicebear-bottts':
      return `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}`;
    case 'ui-official':
      return buildUiAvatarUrl(participant, '0f3d91');
    case 'ui-military':
      return buildUiAvatarUrl(participant, '3c5f2d');
    case 'ui-teacher':
      return buildUiAvatarUrl(participant, '1f6feb');
    case 'pravatar-photo':
      return `https://i.pravatar.cc/256?u=${seed}`;
    case 'robohash-heroes':
      return `https://robohash.org/${seed}.png?size=256x256&set=set4`;
    case 'unavatar-social':
      return `https://unavatar.io/${seed}`;
    default:
      return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
  }
};

const isLegacyGeneratedAvatar = (avatarUrl: string): boolean => {
  return LEGACY_GENERATED_AVATAR_PATTERNS.some(pattern => pattern.test(avatarUrl));
};

const dedupe = (urls: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  urls.forEach((url) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    result.push(url);
  });
  return result;
};

export const getAvatarCandidatesForParticipant = (
  participant: Participant,
  avatarThemeId: AvatarThemeId,
): string[] => {
  const customAvatar = participant.avatar?.trim();
  const primary = buildPrimaryAvatarUrl(participant, avatarThemeId);
  const firstChoice = customAvatar && !isLegacyGeneratedAvatar(customAvatar) ? customAvatar : primary;

  return dedupe([
    firstChoice,
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${buildSeed(participant)}`,
    `https://api.dicebear.com/7.x/personas/svg?seed=${buildSeed(participant)}`,
    buildUiAvatarUrl(participant, '334155'),
    `https://api.dicebear.com/7.x/pixel-art/svg?seed=${buildSeed(participant)}`,
  ]);
};

export const getAvatarUrlForParticipant = (
  participant: Participant,
  avatarThemeId: AvatarThemeId,
): string => {
  return getAvatarCandidatesForParticipant(participant, avatarThemeId)[0];
};

export const getAvatarFallbackUrlForParticipant = (
  participant: Participant,
  avatarThemeId: AvatarThemeId,
): string => {
  const candidates = getAvatarCandidatesForParticipant(participant, avatarThemeId);
  return candidates[candidates.length - 1];
};
