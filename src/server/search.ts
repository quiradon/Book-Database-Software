export function normalizeSearchTerm(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export interface NormalizedSearchCondition {
  sql: string;
  params: [string];
}

export function buildSearchText(values: Array<unknown>): string {
  return normalizeSearchTerm(values.map((value) => String(value ?? '')).join(' '));
}

export function buildSearchTextCondition(
  column: string,
  rawSearch: string | undefined,
): NormalizedSearchCondition | undefined {
  const search = rawSearch?.trim() ? normalizeSearchTerm(rawSearch) : '';

  if (!search) {
    return undefined;
  }

  const likeValue = `%${escapeLikeValue(search)}%`;
  return {
    sql: `${column} LIKE ? ESCAPE '\\'`,
    params: [likeValue],
  };
}

function escapeLikeValue(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
