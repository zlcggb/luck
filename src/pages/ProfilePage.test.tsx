import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { UiAppearanceProvider } from '../contexts/UiAppearanceContext';
import ProfilePage from './ProfilePage';

const auth = vi.hoisted(() => ({
  getUser: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('../utils/supabaseCheckin', () => ({ supabase: { auth } }));

const renderPage = () => render(
  <UiAppearanceProvider>
    <MemoryRouter initialEntries={['/profile']}>
      <Routes>
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/login" element={<div>登录页面</div>} />
      </Routes>
    </MemoryRouter>
  </UiAppearanceProvider>,
);

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem('luck_last_project_id', 'project-8');
    auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'u1',
          email: 'admin@example.com',
          created_at: '2026-03-04T08:00:00.000Z',
          user_metadata: { name: '王小明' },
        },
      },
      error: null,
    });
    auth.signOut.mockResolvedValue({ error: null });
  });

  it('shows read-only account information and the remembered lottery destination', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: '个人信息' })).toBeInTheDocument();
    expect(screen.getByText('王小明')).toBeInTheDocument();
    expect(screen.getAllByText('admin@example.com')).toHaveLength(2);
    expect(screen.getByText('已登录')).toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '抽奖' })).toHaveAttribute('href', '/project/project-8');
    expect(screen.getByRole('link', { name: '我的' })).toHaveAttribute('aria-current', 'page');
  });

  it('retries a failed profile request', async () => {
    auth.getUser
      .mockResolvedValueOnce({ data: { user: null }, error: new Error('network') })
      .mockResolvedValueOnce({
        data: { user: { id: 'u1', email: 'admin@example.com', created_at: null, user_metadata: {} } },
        error: null,
      });
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('暂时无法加载账号资料')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '重新加载' }));
    expect(await screen.findAllByText('admin@example.com')).toHaveLength(2);
    expect(auth.getUser).toHaveBeenCalledTimes(2);
  });

  it('navigates to login after a successful logout', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: '退出登录' }));
    expect(await screen.findByText('登录页面')).toBeInTheDocument();
  });

  it('keeps the page visible when logout fails', async () => {
    auth.signOut.mockResolvedValue({ error: new Error('failed') });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: '退出登录' }));
    expect(await screen.findByText('退出失败，请稍后重试')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '个人信息' })).toBeInTheDocument();
    await waitFor(() => expect(auth.signOut).toHaveBeenCalledOnce());
  });
});
