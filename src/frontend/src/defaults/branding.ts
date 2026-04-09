export const DEFAULT_SYSTEM_NAME = '仓储管理系统';

export function resolveSystemDisplayName(
  instanceName?: string | null
): string {
  const normalized = `${instanceName ?? ''}`.trim();

  if (!normalized || normalized === 'InvenTree') {
    return DEFAULT_SYSTEM_NAME;
  }

  return normalized;
}
