import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UiAppearanceProvider } from '../contexts/UiAppearanceContext';
import {
  SettingsAccountActions,
  SettingsPanelTitleBar,
  SettingsSidebarHeader,
} from './SettingsNavigationControls';

describe('SettingsNavigationControls', () => {
  it('exposes distinct project, workspace, profile, logout and close actions', async () => {
    const user = userEvent.setup();
    const actions = {
      projects: vi.fn(),
      workspace: vi.fn(),
      profile: vi.fn(),
      logout: vi.fn(),
      close: vi.fn(),
      reset: vi.fn(),
    };
    render(
      <UiAppearanceProvider>
        <SettingsSidebarHeader onOpenProjects={actions.projects} />
        <SettingsPanelTitleBar
          onReturnWorkspace={actions.workspace}
          onReset={actions.reset}
          onClose={actions.close}
        />
        <SettingsAccountActions
          displayName="王小明"
          email="admin@example.com"
          onOpenProfile={actions.profile}
          onLogout={actions.logout}
        />
      </UiAppearanceProvider>,
    );

    await user.click(screen.getByRole('button', { name: '返回项目列表' }));
    await user.click(screen.getByRole('button', { name: '返回工作台' }));
    await user.click(screen.getByRole('button', { name: '打开个人信息' }));
    await user.click(screen.getByRole('button', { name: '退出登录' }));
    await user.click(screen.getByRole('button', { name: '关闭设置' }));

    expect(actions.projects).toHaveBeenCalledOnce();
    expect(actions.workspace).toHaveBeenCalledOnce();
    expect(actions.profile).toHaveBeenCalledOnce();
    expect(actions.logout).toHaveBeenCalledOnce();
    expect(actions.close).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: '切换到深色主题' })).toBeInTheDocument();
  });
});
