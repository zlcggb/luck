export const LAST_PROJECT_STORAGE_KEY = 'luck_last_project_id';

export const rememberLastProject = (projectId: string): void => {
  const normalized = projectId.trim();
  if (!normalized) return;
  try {
    window.localStorage.setItem(LAST_PROJECT_STORAGE_KEY, normalized);
  } catch {
    // Navigation must continue when persistence is unavailable.
  }
};

export const getLastProjectId = (): string | null => {
  try {
    const stored = window.localStorage.getItem(LAST_PROJECT_STORAGE_KEY)?.trim();
    return stored || null;
  } catch {
    return null;
  }
};

export const clearLastProject = (projectId?: string): void => {
  try {
    if (projectId && getLastProjectId() !== projectId.trim()) return;
    window.localStorage.removeItem(LAST_PROJECT_STORAGE_KEY);
  } catch {
    // A blocked storage API should not prevent deleting a project.
  }
};

export const resolveLotteryDestination = (projectId?: string | null): string => {
  const normalized = projectId?.trim();
  return normalized ? `/project/${encodeURIComponent(normalized)}` : '/projects';
};

export const selectLotteryProjectId = (
  projectIds: string[],
  recentProjectId: string | null = getLastProjectId(),
): string | null => {
  if (recentProjectId && projectIds.includes(recentProjectId)) return recentProjectId;
  return projectIds[0] || null;
};
