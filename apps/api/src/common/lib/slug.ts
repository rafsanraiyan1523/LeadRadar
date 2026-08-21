import { randomBytes } from 'node:crypto';

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function withUniqueSuffix(slug: string): string {
  const suffix = randomBytes(3).toString('hex');
  return `${slug || 'org'}-${suffix}`;
}
