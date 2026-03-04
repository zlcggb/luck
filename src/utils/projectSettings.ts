// ============================================
// 项目设置 — 数据库同步工具
// 将项目级配置（主题、音乐、头像风格等）存储到
// luck_events.settings JSONB 字段中
// ============================================

import { supabase } from './supabaseCheckin';
import {
  BackgroundMusicSettings,
  DEFAULT_BACKGROUND_MUSIC,
  ThemeId,
  ThemePalette,
  AvatarThemeId,
} from '../types';
import { DEFAULT_CUSTOM_THEME, DEFAULT_THEME_ID, isThemeId } from '../theme';
import { DEFAULT_AVATAR_THEME_ID, isAvatarThemeId } from '../avatarTheme';

// ============================================
// 类型定义
// ============================================

/** 存储在 luck_events.settings 中的项目配置 */
export interface ProjectSettings {
  // 主题
  themeId?: ThemeId;
  customThemePalette?: ThemePalette;
  avatarThemeId?: AvatarThemeId;
  // 背景音乐
  backgroundMusic?: BackgroundMusicSettings;
  // 转盘式表单设置（原有，保持兼容）
  formTitle?: string;
  formTitleEn?: string;
  formSubtitle?: string;
  formSubtitleEn?: string;
  formButtonText?: string;
  formButtonTextEn?: string;
  footerText?: string;
  footerTextEn?: string;
  wheelTitle?: string;
  wheelTitleEn?: string;
  wheelSubtitle?: string;
  wheelSubtitleEn?: string;
  formFields?: unknown[];
  // 允许其他自定义字段
  [key: string]: unknown;
}

// ============================================
// 读取项目设置
// ============================================

/**
 * 从数据库加载项目设置
 * @param projectId 项目 ID
 * @returns 项目设置对象，如果失败返回 null
 */
export const loadProjectSettings = async (projectId: string): Promise<ProjectSettings | null> => {
  try {
    const { data, error } = await supabase
      .from('luck_events')
      .select('settings')
      .eq('id', projectId)
      .single();

    if (error) {
      console.error('加载项目设置失败:', error);
      return null;
    }

    return (data?.settings as ProjectSettings) || {};
  } catch (err) {
    console.error('加载项目设置异常:', err);
    return null;
  }
};

/**
 * 从项目设置中解析主题 ID
 */
export const getThemeIdFromSettings = (settings: ProjectSettings): ThemeId => {
  const value = settings.themeId;
  if (value && isThemeId(value)) {
    return value;
  }
  return DEFAULT_THEME_ID;
};

/**
 * 从项目设置中解析自定义主题色板
 */
export const getCustomThemePaletteFromSettings = (settings: ProjectSettings): ThemePalette => {
  const palette = settings.customThemePalette;
  if (palette && typeof palette === 'object') {
    return {
      ...DEFAULT_CUSTOM_THEME,
      ...palette,
    };
  }
  return DEFAULT_CUSTOM_THEME;
};

/**
 * 从项目设置中解析头像风格
 */
export const getAvatarThemeIdFromSettings = (settings: ProjectSettings): AvatarThemeId => {
  const value = settings.avatarThemeId;
  if (value && isAvatarThemeId(value)) {
    return value;
  }
  return DEFAULT_AVATAR_THEME_ID;
};

/**
 * 从项目设置中解析背景音乐
 */
export const getBackgroundMusicFromSettings = (settings: ProjectSettings): BackgroundMusicSettings => {
  const music = settings.backgroundMusic;
  if (music && typeof music === 'object') {
    return {
      ...DEFAULT_BACKGROUND_MUSIC,
      ...music,
    };
  }
  return DEFAULT_BACKGROUND_MUSIC;
};

// ============================================
// 保存项目设置
// ============================================

/**
 * 保存项目设置到数据库（合并更新，不会覆盖其他字段）
 * @param projectId 项目 ID
 * @param updates 要更新的设置字段
 * @returns 是否成功
 */
export const saveProjectSettings = async (
  projectId: string,
  updates: Partial<ProjectSettings>
): Promise<boolean> => {
  try {
    // 先读取当前 settings，然后合并
    const { data: current, error: readError } = await supabase
      .from('luck_events')
      .select('settings')
      .eq('id', projectId)
      .single();

    if (readError) {
      console.error('读取项目设置失败:', readError);
      return false;
    }

    const currentSettings = (current?.settings as Record<string, unknown>) || {};
    const mergedSettings = { ...currentSettings, ...updates };

    const { error: writeError } = await supabase
      .from('luck_events')
      .update({
        settings: mergedSettings,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    if (writeError) {
      console.error('保存项目设置失败:', writeError);
      return false;
    }

    console.log('✅ 项目设置已同步到数据库:', Object.keys(updates).join(', '));
    return true;
  } catch (err) {
    console.error('保存项目设置异常:', err);
    return false;
  }
};

/**
 * 批量保存主题相关设置
 */
export const saveThemeSettings = async (
  projectId: string,
  themeId: ThemeId,
  customThemePalette: ThemePalette,
  avatarThemeId: AvatarThemeId
): Promise<boolean> => {
  return saveProjectSettings(projectId, {
    themeId,
    customThemePalette,
    avatarThemeId,
  });
};

/**
 * 保存背景音乐设置
 */
export const saveBackgroundMusicToProject = async (
  projectId: string,
  backgroundMusic: BackgroundMusicSettings
): Promise<boolean> => {
  return saveProjectSettings(projectId, { backgroundMusic });
};
