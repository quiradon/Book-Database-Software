export function normalizeSearchTerm(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function containsNormalizedSearch(values: Array<unknown>, search: string): boolean {
  return values.some((value) => normalizeSearchTerm(String(value ?? '')).includes(search));
}
