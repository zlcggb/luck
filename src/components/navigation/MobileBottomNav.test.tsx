import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MobileBottomNav from './MobileBottomNav';

const renderNav = (projectId?: string | null) => render(
  <MemoryRouter>
    <MobileBottomNav active="lottery" lotteryProjectId={projectId} />
  </MemoryRouter>,
);

describe('MobileBottomNav', () => {
  it('renders three stable destinations with one current page', () => {
    renderNav('current-id');

    expect(screen.getByRole('link', { name: '项目' })).toHaveAttribute('href', '/projects');
    expect(screen.getByRole('link', { name: '抽奖' })).toHaveAttribute('href', '/project/current-id');
    expect(screen.getByRole('link', { name: '我的' })).toHaveAttribute('href', '/profile');
    expect(screen.getByRole('link', { name: '抽奖' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: '项目' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: '我的' })).not.toHaveAttribute('aria-current');
  });

  it('falls back to projects when no lottery project exists', () => {
    renderNav(null);
    expect(screen.getByRole('link', { name: '抽奖' })).toHaveAttribute('href', '/projects');
  });

  it('is fixed to the safe area and hidden from tablet widths upward', () => {
    renderNav('p1');
    const nav = screen.getByRole('navigation', { name: '手机端主导航' });
    expect(nav).toHaveClass('fixed', 'bottom-0', 'sm:hidden', 'vip-mobile-bottom-nav');
  });
});
