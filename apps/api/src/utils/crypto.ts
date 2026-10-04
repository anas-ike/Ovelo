import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('hex');
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const safeEquals = (left: string, right: string) => {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};
export const randomInventoryCode = () => `OVL-${randomBytes(4).toString('hex').toUpperCase()}`;
