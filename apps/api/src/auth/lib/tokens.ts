import { createHash, randomBytes } from 'node:crypto';

export interface OpaqueToken {
  /** The raw, high-entropy value — sent to the client/user, never persisted. */
  token: string;
  /** SHA-256 of `token` — safe to store; a DB leak alone can't be replayed. */
  tokenHash: string;
}

export function generateOpaqueToken(): OpaqueToken {
  const token = randomBytes(32).toString('hex');
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
