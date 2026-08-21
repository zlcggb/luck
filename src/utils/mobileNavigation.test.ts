import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LAST_PROJECT_STORAGE_KEY,
  clearLastProject,
  getLastProjectId,
  rememberLastProject,
  resolveLotteryDestination,
  selectLotteryProjectId,
} from './mobileNavigation';

describe('mobileNavigation', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('saves a trimmed project id and ignores an empty replacement', () => {
    rememberLastProject('  project-1  ');
    rememberLastProject('   ');

    expect(getLastProjectId()).toBe('project-1');
    expect(window.localStorage.getItem(LAST_PROJECT_STORAGE_KEY)).toBe('project-1');
  });

  it('clears only the requested current id or clears unconditionally', () => {
    rememberLastProject('project-1');
    clearLastProject('project-2');
    expect(getLastProjectId()).toBe('project-1');

    clearLastProject('project-1');
    expect(getLastProjectId()).toBeNull();

    rememberLastProject('project-3');
    clearLastProject();
    expect(getLastProjectId()).toBeNull();
  });

  it('does not throw when browser storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('blocked');
    });

    expect(() => rememberLastProject('project-1')).not.toThrow();
    expect(getLastProjectId()).toBeNull();
    expect(() => clearLastProject()).not.toThrow();
  });

  it('resolves an encoded project destination or the project list fallback', () => {
    expect(resolveLotteryDestination('event/a')).toBe('/project/event%2Fa');
    expect(resolveLotteryDestination(null)).toBe('/projects');
    expect(resolveLotteryDestination(' ')).toBe('/projects');
  });

  it('uses a valid recent project and falls back to the first available project', () => {
    expect(selectLotteryProjectId(['p1', 'p2'], 'p2')).toBe('p2');
    expect(selectLotteryProjectId(['p1', 'p2'], 'deleted')).toBe('p1');
    expect(selectLotteryProjectId([], 'deleted')).toBeNull();
  });
});
