import { describe, expect, it } from 'vitest';
import { itemSchema, registerSchema } from '@ovelo/validation';

describe('server validation', () => {
  it('requires strong passwords at registration', () => {
    expect(() =>
      registerSchema.parse({ name: 'A', email: 'a@gmail.com', password: 'short' }),
    ).toThrow();
  });
  it('does not accept client-owned authority fields on item input', () => {
    expect(() => itemSchema.parse({ name: 'Camera', userId: 'not-accepted' })).toThrow();
  });
  it('normalizes email addresses before the service layer', () => {
    expect(
      registerSchema.parse({ name: 'A', email: 'A@GMAIL.COM', password: 'a-strong-password-123' })
        .email,
    ).toBe('a@gmail.com');
  });
});
