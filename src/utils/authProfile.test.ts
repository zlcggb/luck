import { describe, expect, it } from 'vitest';
import { getAuthDisplayName, getAuthInitial } from './authProfile';

describe('authProfile', () => {
  it('prefers a trimmed metadata name', () => {
    expect(getAuthDisplayName({ email: 'admin@example.com', user_metadata: { name: '  王小明  ' } })).toBe('王小明');
  });

  it('falls back to the email prefix and then a manager label', () => {
    expect(getAuthDisplayName({ email: 'admin@example.com', user_metadata: { name: ' ' } })).toBe('admin');
    expect(getAuthDisplayName({ email: null, user_metadata: null })).toBe('管理员');
  });

  it('creates a stable initial for Chinese and Latin names', () => {
    expect(getAuthInitial('王小明')).toBe('王');
    expect(getAuthInitial(' admin ')).toBe('A');
  });
});
