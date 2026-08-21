import { describe, expect, it } from 'vitest';
import {
  buildLoginRedirect,
  getModeDestination,
  resolvePostAuthDestination,
} from './authNavigation';

describe('auth navigation', () => {
  it('preserves the selected rolling mode through login', () => {
    expect(getModeDestination('rolling')).toBe('/projects?create=rolling');
    expect(buildLoginRedirect('/projects?create=rolling')).toBe(
      '/login?next=%2Fprojects%3Fcreate%3Drolling&mode=rolling',
    );
  });

  it('preserves the wheel mode through login', () => {
    expect(getModeDestination('wheel')).toBe('/projects?create=wheel');
    expect(buildLoginRedirect('/projects?create=wheel')).toBe(
      '/login?next=%2Fprojects%3Fcreate%3Dwheel&mode=wheel',
    );
  });

  it('rejects external and protocol-relative post-login redirects', () => {
    expect(resolvePostAuthDestination('https://evil.example')).toBe('/projects');
    expect(resolvePostAuthDestination('//evil.example')).toBe('/projects');
    expect(resolvePostAuthDestination('/projects?create=rolling')).toBe(
      '/projects?create=rolling',
    );
  });
});
