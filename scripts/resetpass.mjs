import process from 'node:process';
import console from 'node:console';
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import { adminPassword, email } from '@ovelo/validation';
import { databaseUrl } from '../packages/shared/dist/database.js';
import { pathToFileURL } from 'node:url';

export function promptSecret(label, input = process.stdin, output = process.stdout) {
  if (!input.isTTY || !input.setRawMode) throw new Error('Password reset requires an interactive terminal; passwords cannot be supplied as arguments or logged input');
  return new Promise((resolve, reject) => {
    let value = '';
    input.setRawMode(true); output.write(label); input.resume();
    const cleanup = () => { input.off('data', receive); input.setRawMode(false); input.pause(); output.write('\n'); };
    const receive = data => { for (const char of data.toString('utf8')) {
      if (char === '\u0003') { cleanup(); reject(new Error('Password reset cancelled')); return; }
      if (char === '\r' || char === '\n') { cleanup(); resolve(value); return; }
      if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
      else if (char.charCodeAt(0) >= 32 && value.length < 129) value += char;
    } };
    input.on('data', receive);
  });
}
export async function resetMainPassword() {
let prisma;
try {
  prisma = new PrismaClient({ log: [], datasourceUrl: databaseUrl(process.env.DATABASE_URL) });
  const targetEmail = email.parse(process.env.ADMIN_EMAIL);
  const first = await promptSecret('New main-admin password (at least 16 characters): ');
  const second = await promptSecret('Confirm new password: ');
  if (first !== second) throw new Error('Passwords do not match');
  const parsed = adminPassword.safeParse(first); if (!parsed.success) throw new Error('New password must contain 16–128 characters');
  const primary = await prisma.user.findFirst({ where: { isPrimaryAdmin: true }, select: { id: true, email: true } });
  if (primary && primary.email !== targetEmail) throw new Error('Configured ADMIN_EMAIL does not match the primary administrator');
  const existing = await prisma.user.findUnique({ where: { email: targetEmail }, select: { id: true, role: true, disabledAt: true, deletedAt: true } });
  if (!primary && existing && (existing.role === 'USER' || existing.disabledAt || existing.deletedAt)) throw new Error('Refusing to elevate an existing normal/disabled account');
  const passwordHash = await argon2.hash(parsed.data, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3 });
  await prisma.$transaction(async tx => {
    const user = existing ? await tx.user.update({ where: { id: existing.id }, data: { passwordHash, role: 'OWNER', isPrimaryAdmin: true } }) : await tx.user.create({ data: { email: targetEmail, name: 'Ovelo owner', role: 'OWNER', isPrimaryAdmin: true, emailVerifiedAt: new Date(), passwordHash } });
    await tx.session.deleteMany({ where: { userId: user.id } }); await tx.passwordReset.deleteMany({ where: { userId: user.id } });
    await tx.adminAuditLog.create({ data: { adminId: user.id, action: 'PRIMARY_PASSWORD_RESET_CLI', targetType: 'User', targetId: user.id, requestId: 'secure-cli' } });
  });
  console.info('Main administrator password updated; all sessions and reset tickets revoked. The database is authoritative; .env was not modified.');
} catch (error) {
  const allowed = ['Passwords do not match', 'New password must contain 16–128 characters', 'Password reset cancelled', 'Configured ADMIN_EMAIL does not match the primary administrator', 'Refusing to elevate an existing normal/disabled account'];
  console.error(allowed.includes(error?.message) ? error.message : 'Main administrator reset failed. Check interactive terminal, environment, migrations and database access.'); process.exitCode = 1;
} finally { await prisma?.$disconnect(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await resetMainPassword();
