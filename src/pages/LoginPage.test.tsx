import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import LoginPage from './LoginPage';

const auth = vi.hoisted(() => ({
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock('../utils/supabaseCheckin', () => ({ supabase: { auth } }));

const ProjectDestination = () => {
  const location = useLocation();
  return <div>项目页面 {location.search}</div>;
};

const renderPage = (entry: string) => render(
  <MemoryRouter initialEntries={[entry]}>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/projects" element={<ProjectDestination />} />
    </Routes>
  </MemoryRouter>,
);

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    auth.signOut.mockResolvedValue({ error: null });
  });

  it('opens registration for a selected mode and returns to login without email verification', async () => {
    auth.signUp.mockResolvedValue({
      data: { user: { id: 'u1' }, session: { access_token: 'token' } },
      error: null,
    });
    const user = userEvent.setup();
    renderPage('/login?next=%2Fprojects%3Fcreate%3Drolling&mode=rolling');

    expect(screen.getByRole('heading', { name: '创建管理账号' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('姓名'), '  王小明  ');
    await user.type(screen.getByLabelText('邮箱'), 'Admin@Example.com');
    await user.type(screen.getByLabelText('密码'), 'Password123');
    await user.type(screen.getByLabelText('确认密码'), 'Password123');
    await user.click(screen.getByRole('button', { name: '创建账号' }));

    await waitFor(() => expect(auth.signUp).toHaveBeenCalledWith({
      email: 'admin@example.com',
      password: 'Password123',
      options: { data: { name: '王小明' } },
    }));
    expect(auth.signOut).toHaveBeenCalledOnce();
    expect(await screen.findByRole('heading', { name: '登录账号' })).toBeInTheDocument();
    expect(screen.getByText('注册成功，请使用新账号登录')).toBeInTheDocument();
    expect(screen.queryByText(/查收|验证邮件/)).not.toBeInTheDocument();
  });

  it('restores the selected mode after login', async () => {
    auth.signInWithPassword.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const user = userEvent.setup();
    renderPage('/login?next=%2Fprojects%3Fcreate%3Dwheel');

    await user.type(screen.getByLabelText('邮箱'), 'admin@example.com');
    await user.type(screen.getByLabelText('密码'), 'Password123');
    await user.click(screen.getByRole('button', { name: '登录' }));

    expect(await screen.findByText('项目页面 ?create=wheel')).toBeInTheDocument();
  });

  it('validates password confirmation before registration', async () => {
    const user = userEvent.setup();
    renderPage('/login?mode=rolling');

    await user.type(screen.getByLabelText('姓名'), '王小明');
    await user.type(screen.getByLabelText('邮箱'), 'admin@example.com');
    await user.type(screen.getByLabelText('密码'), 'Password123');
    await user.type(screen.getByLabelText('确认密码'), 'Password456');
    await user.click(screen.getByRole('button', { name: '创建账号' }));

    expect(await screen.findByText('两次输入的密码不一致')).toBeInTheDocument();
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('requires complete registration details and an eight character password', async () => {
    const user = userEvent.setup();
    renderPage('/login?mode=rolling');

    await user.click(screen.getByRole('button', { name: '创建账号' }));
    expect(await screen.findByText('请完整填写账号信息')).toBeInTheDocument();

    await user.type(screen.getByLabelText('姓名'), '小明');
    await user.type(screen.getByLabelText('邮箱'), 'user@example.com');
    await user.type(screen.getByLabelText('密码'), 'short');
    await user.type(screen.getByLabelText('确认密码'), 'short');
    await user.click(screen.getByRole('button', { name: '创建账号' }));

    expect(await screen.findByText('密码至少需要 8 位字符')).toBeInTheDocument();
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('shows a friendly message when login credentials are invalid', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: new Error('Invalid login credentials'),
    });
    const user = userEvent.setup();
    renderPage('/login');

    await user.type(screen.getByLabelText('邮箱'), 'user@example.com');
    await user.type(screen.getByLabelText('密码'), 'Password123');
    await user.click(screen.getByRole('button', { name: '登录' }));

    expect(await screen.findByText('邮箱或密码错误，请重新输入')).toBeInTheDocument();
  });

  it('redirects an already authenticated manager and supports password visibility', async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const user = userEvent.setup();
    renderPage('/login?next=%2Fprojects%3Fcreate%3Drolling');

    expect(await screen.findByText('项目页面 ?create=rolling')).toBeInTheDocument();
    auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    renderPage('/login');
    const password = screen.getAllByLabelText('密码')[0];
    expect(password).toHaveAttribute('type', 'password');
    await user.click(screen.getAllByRole('button', { name: '显示密码' })[0]);
    expect(password).toHaveAttribute('type', 'text');
  });
});
