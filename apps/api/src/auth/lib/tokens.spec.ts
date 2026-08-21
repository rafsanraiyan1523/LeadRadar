import { generateOpaqueToken, hashToken } from './tokens';

describe('opaque tokens', () => {
  it('generates high-entropy, unique tokens', () => {
    const a = generateOpaqueToken();
    const b = generateOpaqueToken();
    expect(a.token).not.toEqual(b.token);
    expect(a.token).toHaveLength(64);
  });

  it('hashes deterministically so a stored hash can be matched later', () => {
    const { token, tokenHash } = generateOpaqueToken();
    expect(hashToken(token)).toEqual(tokenHash);
  });

  it('does not store the raw token inside its own hash', () => {
    const { token, tokenHash } = generateOpaqueToken();
    expect(tokenHash).not.toEqual(token);
    expect(tokenHash).toHaveLength(64);
  });
});
