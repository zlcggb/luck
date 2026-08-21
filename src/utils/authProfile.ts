interface AuthProfileLike {
  email?: string | null;
  user_metadata?: { name?: unknown } | null;
}

export const getAuthDisplayName = (user: AuthProfileLike): string => {
  const metadataName = typeof user.user_metadata?.name === 'string'
    ? user.user_metadata.name.trim()
    : '';
  if (metadataName) return metadataName;

  const emailPrefix = user.email?.split('@')[0]?.trim();
  return emailPrefix || '管理员';
};

export const getAuthInitial = (displayName: string): string => {
  const initial = Array.from(displayName.trim())[0] || '管';
  return /[a-z]/i.test(initial) ? initial.toUpperCase() : initial;
};
