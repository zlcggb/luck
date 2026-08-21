import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RequireAuth from './RequireAuth';

const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }));

vi.mock('../../utils/supabaseCheckin', () => ({
  supabase: { auth: { getUser } },
}));

const renderGuard = (initialPath = '/lottery/rolling?event=e1') => render(
  <MemoryRouter initialEntries={[initialPath]}>
    <Routes>
      <Route path="/login" element={<div>登录页面</div>} />
      <Route element={<RequireAuth />}>
        <Route path="/lottery/rolling" element={<div>轮动管理页</div>} />
      </Route>
    </Routes>
  </MemoryRouter>,
);

describe('RequireAuth', () => {
  it('redirects anonymous visitors to login', async () => {
    getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    renderGuard();
    expect(await screen.findByText('登录页面')).toBeInTheDocument();
  });

  it('renders protected content for an authenticated user', async () => {
    getUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null });
    renderGuard();
    await waitFor(() => expect(screen.getByText('轮动管理页')).toBeInTheDocument());
  });
});
