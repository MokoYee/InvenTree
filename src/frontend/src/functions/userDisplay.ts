const CJK_NAME_PATTERN = /[\u3400-\u9fff\uf900-\ufaff]/;

export function formatUserDisplayName(
  firstName?: string | null,
  lastName?: string | null
): string {
  const first = `${firstName ?? ''}`.trim();
  const last = `${lastName ?? ''}`.trim();

  if (!first && !last) {
    return '';
  }

  if (CJK_NAME_PATTERN.test(`${last}${first}`)) {
    return `${last}${first}`.trim();
  }

  return [first, last].filter(Boolean).join(' ');
}
