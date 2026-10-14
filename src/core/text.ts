export function slugify(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'song';
}

/** "<title> (my copy)", or "(my copy 2)", "(my copy 3)", … when that name is taken. */
export function copyTitle(title: string, taken: readonly string[]): string {
  const names = new Set(taken);
  const first = `${title} (my copy)`;
  if (!names.has(first)) return first;
  for (let n = 2; ; n++) {
    const candidate = `${title} (my copy ${n})`;
    if (!names.has(candidate)) return candidate;
  }
}
