-- ============================================
-- 抽奖系统 - 项目设置同步到数据库
-- 日期: 2026-03-04
-- 说明: luck_events.settings (JSONB) 字段已存在，无需 DDL 变更
--       本文件记录 settings JSONB 的结构设计与查询示例
-- ============================================

-- luck_events.settings JSONB 结构设计：
-- {
--   // --- 转盘式表单配置（原有） ---
--   "formTitle": "string",
--   "formTitleEn": "string",
--   "formSubtitle": "string",
--   "formSubtitleEn": "string",
--   "formButtonText": "string",
--   "formButtonTextEn": "string",
--   "footerText": "string",
--   "footerTextEn": "string",
--   "wheelTitle": "string",
--   "wheelTitleEn": "string",
--   "wheelSubtitle": "string",
--   "wheelSubtitleEn": "string",
--   "formFields": [...],
--
--   // --- 新增：主题配置 ---
--   "themeId": "nebula | festival | macos | clarity | ... | custom",
--   "customThemePalette": {
--     "primary": "#hex",
--     "secondary": "#hex",
--     "accent": "#hex",
--     "bgBase": "#hex",
--     "bgDeep": "#hex"
--   },
--   "avatarThemeId": "dicebear-avataaars | dicebear-open-peeps | ...",
--
--   // --- 新增：背景音乐 ---
--   "backgroundMusic": {
--     "src": "url",
--     "name": "string",
--     "presetId": "default | custom"
--   }
-- }

-- 查询示例：获取所有项目的设置
SELECT id, name, mode, settings FROM luck_events ORDER BY created_at DESC;

-- 查询示例：获取特定项目的主题设置
SELECT 
  id,
  name,
  settings->>'themeId' AS theme_id,
  settings->'customThemePalette' AS custom_palette,
  settings->>'avatarThemeId' AS avatar_theme,
  settings->'backgroundMusic' AS bg_music
FROM luck_events
WHERE id = 'YOUR_PROJECT_ID';

-- 更新示例：保存主题设置到 settings JSONB
UPDATE luck_events
SET settings = settings || jsonb_build_object(
  'themeId', 'nebula',
  'avatarThemeId', 'dicebear-avataaars',
  'backgroundMusic', jsonb_build_object(
    'src', 'https://example.com/music.mp3',
    'name', '默认音乐',
    'presetId', 'default'
  )
),
updated_at = now()
WHERE id = 'YOUR_PROJECT_ID';

-- 更新示例：保存自定义主题色板
UPDATE luck_events
SET settings = settings || jsonb_build_object(
  'themeId', 'custom',
  'customThemePalette', jsonb_build_object(
    'primary', '#3b82f6',
    'secondary', '#8b5cf6',
    'accent', '#f59e0b',
    'bgBase', '#0b0a1a',
    'bgDeep', '#050510'
  )
),
updated_at = now()
WHERE id = 'YOUR_PROJECT_ID';
