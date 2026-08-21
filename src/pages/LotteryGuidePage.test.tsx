import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import LotteryGuidePage from './LotteryGuidePage';

const Destination = () => {
  const location = useLocation();
  return <div>项目模式 {location.search}</div>;
};

describe('LotteryGuidePage', () => {
  it.each([
    ['转盘式抽奖', '?create=wheel'],
    ['轮动式抽奖', '?create=rolling'],
  ])('routes %s through the protected project flow', async (buttonName, expectedSearch) => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<LotteryGuidePage />} />
          <Route path="/projects" element={<Destination />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: new RegExp(buttonName) }));
    expect(await screen.findByText(`项目模式 ${expectedSearch}`)).toBeInTheDocument();
  });
});
