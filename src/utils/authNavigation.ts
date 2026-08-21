export type LotteryMode = 'wheel' | 'rolling';

const DEFAULT_DESTINATION = '/projects';

export const getModeDestination = (mode: LotteryMode): string =>
  `/projects?create=${mode}`;

export const resolvePostAuthDestination = (next: string | null | undefined): string => {
  if (!next || !next.startsWith('/') || next.startsWith('//')) {
    return DEFAULT_DESTINATION;
  }
  return next;
};

export const getModeFromDestination = (destination: string): LotteryMode | null => {
  const queryIndex = destination.indexOf('?');
  if (queryIndex < 0) return null;
  const params = new URLSearchParams(destination.slice(queryIndex + 1));
  const mode = params.get('create');
  return mode === 'wheel' || mode === 'rolling' ? mode : null;
};

export const buildLoginRedirect = (next: string): string => {
  const destination = resolvePostAuthDestination(next);
  const params = new URLSearchParams({ next: destination });
  const mode = getModeFromDestination(destination);
  if (mode) params.set('mode', mode);
  return `/login?${params.toString()}`;
};
