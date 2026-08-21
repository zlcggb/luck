import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  UI_APPEARANCE_STORAGE_KEY,
  UiAppearanceProvider,
  useUiAppearance,
} from './UiAppearanceContext';

const AppearanceProbe = () => {
  const { appearance, toggleAppearance } = useUiAppearance();
  return (
    <div>
      <output aria-label="当前主题">{appearance}</output>
      <button onClick={toggleAppearance}>切换主题</button>
    </div>
  );
};

const renderProvider = () => render(
  <UiAppearanceProvider>
    <AppearanceProbe />
  </UiAppearanceProvider>,
);

describe('UiAppearanceProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('defaults to light and persists a manual toggle', async () => {
    const user = userEvent.setup();
    renderProvider();

    expect(screen.getByLabelText('当前主题')).toHaveTextContent('light');
    await user.click(screen.getByRole('button', { name: '切换主题' }));

    expect(screen.getByLabelText('当前主题')).toHaveTextContent('dark');
    expect(window.localStorage.getItem(UI_APPEARANCE_STORAGE_KEY)).toBe('dark');
  });

  it('restores a saved dark appearance', () => {
    window.localStorage.setItem(UI_APPEARANCE_STORAGE_KEY, 'dark');
    renderProvider();

    expect(screen.getByLabelText('当前主题')).toHaveTextContent('dark');
  });

  it('ignores invalid stored values', () => {
    window.localStorage.setItem(UI_APPEARANCE_STORAGE_KEY, 'festival');
    renderProvider();

    expect(screen.getByLabelText('当前主题')).toHaveTextContent('light');
  });

  it('continues with in-memory state when storage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked');
    });
    const user = userEvent.setup();
    renderProvider();

    expect(screen.getByLabelText('当前主题')).toHaveTextContent('light');
    await user.click(screen.getByRole('button', { name: '切换主题' }));
    expect(screen.getByLabelText('当前主题')).toHaveTextContent('dark');
  });
});
