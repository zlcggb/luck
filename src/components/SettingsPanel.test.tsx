import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SettingsPanel from './SettingsPanel';
import { UiAppearanceProvider } from '../contexts/UiAppearanceContext';
import { ModalProvider } from '../contexts/ModalContext';
import { DEFAULT_CUSTOM_THEME, DEFAULT_THEME_ID } from '../theme';
import { DEFAULT_AVATAR_THEME_ID } from '../avatarTheme';
import { DEFAULT_BACKGROUND_MUSIC } from '../types';

const auth = vi.hoisted(() => ({
  getUser: vi.fn(),
}));

const checkinMocks = vi.hoisted(() => ({
  getUserProjects: vi.fn(),
  getOrCreateUser: vi.fn(),
  getActiveEvent: vi.fn(),
  createProject: vi.fn(),
  deleteProject: vi.fn(),
  importParticipants: vi.fn(),
  addParticipant: vi.fn(),
  clearCheckInRecordsForEvent: vi.fn(),
  getCheckInCount: vi.fn().mockResolvedValue(0),
  getParticipantCount: vi.fn().mockResolvedValue(0),
}));

vi.mock('../utils/supabaseCheckin', () => ({
  supabase: { auth },
  ...checkinMocks,
}));

describe('SettingsPanel - Project list mode filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();

    auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          user_metadata: { name: '测试用户' },
        },
      },
    });

    checkinMocks.getOrCreateUser.mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
      name: '测试用户',
    });

    checkinMocks.getUserProjects.mockResolvedValue([
      {
        id: 'proj-rolling-1',
        name: '2026年会大屏',
        mode: 'rolling',
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'proj-wheel-1',
        name: '2026ISLE转盘',
        mode: 'wheel',
        created_at: '2026-01-02T00:00:00Z',
      },
      {
        id: 'proj-rolling-2',
        name: '2026展会抽奖',
        mode: 'rolling',
        created_at: '2026-01-03T00:00:00Z',
      },
    ]);
  });

  it('only displays rolling projects in sidebar and filters out wheel projects', async () => {
    render(
      <UiAppearanceProvider>
        <ModalProvider>
          <MemoryRouter>
            <SettingsPanel
              isOpen={true}
              onClose={vi.fn()}
              participants={[]}
              onParticipantsChange={vi.fn()}
              prizes={[]}
              onPrizesChange={vi.fn()}
              records={[]}
              onRecordsChange={vi.fn()}
              onUndoRecord={vi.fn()}
              onClearAll={vi.fn()}
              themeId={DEFAULT_THEME_ID}
              onThemeChange={vi.fn()}
              customThemePalette={DEFAULT_CUSTOM_THEME}
              onCustomThemePaletteChange={vi.fn()}
              avatarThemeId={DEFAULT_AVATAR_THEME_ID}
              onAvatarThemeChange={vi.fn()}
              backgroundMusic={DEFAULT_BACKGROUND_MUSIC}
              onBackgroundMusicChange={vi.fn()}
              isMusicPlaying={false}
              onToggleMusic={vi.fn()}
            />
          </MemoryRouter>
        </ModalProvider>
      </UiAppearanceProvider>
    );

    // 应该展示轮动项目
    expect((await screen.findAllByText('2026年会大屏')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('2026展会抽奖').length).toBeGreaterThan(0);

    // 不应该展示转盘项目
    expect(screen.queryByText('2026ISLE转盘')).not.toBeInTheDocument();
  });
});
