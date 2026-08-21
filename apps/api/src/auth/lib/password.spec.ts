import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('produces a hash that verifies against the original password', async () => {
    const hash = await hashPassword('correct-horse-battery-staple1');
    await expect(
      verifyPassword(hash, 'correct-horse-battery-staple1'),
    ).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct-horse-battery-staple1');
    await expect(verifyPassword(hash, 'wrong-password1')).resolves.toBe(false);
  });

  it('never stores the plaintext password in the hash', async () => {
    const password = 'correct-horse-battery-staple1';
    const hash = await hashPassword(password);
    expect(hash).not.toContain(password);
  });

  it('salts each hash uniquely, even for the same password', async () => {
    const [a, b] = await Promise.all([
      hashPassword('same-password1'),
      hashPassword('same-password1'),
    ]);
    expect(a).not.toEqual(b);
  });
});
