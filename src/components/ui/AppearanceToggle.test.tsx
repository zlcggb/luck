import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UiAppearanceProvider, useUiAppearance } from '../../contexts/UiAppearanceContext';
import AppearanceToggle from './AppearanceToggle';

const Probe = () => <output aria-label="同步主题">{useUiAppearance().appearance}</output>;

describe('AppearanceToggle', () => {
  beforeEach(() => window.localStorage.clear());

  it('switches shared appearance state between two entry points', async () => {
    const user = userEvent.setup();
    render(
      <UiAppearanceProvider>
        <AppearanceToggle />
        <AppearanceToggle />
        <Probe />
      </UiAppearanceProvider>,
    );

    const darkButtons = screen.getAllByRole('button', { name: '切换到深色主题' });
    expect(darkButtons).toHaveLength(2);
    await user.click(darkButtons[0]);

    expect(screen.getByLabelText('同步主题')).toHaveTextContent('dark');
    expect(screen.getAllByRole('button', { name: '切换到浅色主题' })).toHaveLength(2);
  });
});
