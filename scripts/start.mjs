import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import process from 'node:process';
import { setTimeout, clearTimeout } from 'node:timers';
import releases from '../CHANGELOG.js';
import console from 'node:console';

// Keep the existing start:api/start:worker/start:web commands as the single source
// of truth. Run Node directly: no shells, PID discovery, ps, or tree-kill.
export function supervise(commands, { cwd, env = process.env, timeoutMs = 15000 } = {}) {
  const children = new Set();
  let stopping = false;
  let exitCode = 0;
  let deadline;
  let finish;
  const done = new Promise((resolve) => { finish = resolve; });
  function complete() {
    if (!stopping || children.size) return;
    clearTimeout(deadline);
    process.off('SIGTERM', terminate);
    process.off('SIGINT', interrupt);
    finish(exitCode);
  }
  function stop(signal, code = 0) {
    if (stopping) return;
    stopping = true;
    exitCode = code;
    for (const child of children) child.kill(signal);
    deadline = setTimeout(() => {
      exitCode = 1;
      for (const child of children) child.kill('SIGKILL');
    }, timeoutMs);
    complete();
  }
  const terminate = () => stop('SIGTERM');
  const interrupt = () => stop('SIGINT');
  process.on('SIGTERM', terminate);
  process.on('SIGINT', interrupt);
  for (const [name, args] of Object.entries(commands)) {
    const child = spawn(process.execPath, args, { cwd, env, stdio: 'inherit', shell: false });
    children.add(child);
    child.on('error', (error) => {
      process.stderr.write(JSON.stringify({ level: 'error', service: name, code: error.code || 'SPAWN_FAILED', message: 'Ovelo process could not start' }) + '\n');
      stop('SIGTERM', 1);
    });
    child.on('exit', (code, signal) => {
      if (!stopping) {
        process.stderr.write(JSON.stringify({ level: 'error', service: name, code, signal, message: 'Ovelo process exited unexpectedly' }) + '\n');
        stop('SIGTERM', code || 1);
      } else if (code !== null && code !== 0) exitCode = code;
    });
    child.on('close', () => {
      children.delete(child);
      complete();
    });
  }
  return done;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const { scripts, version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  if (releases.changelog[0].version !== version) throw new Error('Release metadata mismatch');
  console.info(`Ovelo v${version} — ${releases.changelog[0].name}`);
  const commands = Object.fromEntries(['api', 'worker', 'web'].map((name) => {
    const [executable, ...args] = scripts[`start:${name}`].split(' ');
    if (executable !== 'node') throw new Error('Production service commands must run Node directly');
    return [name, args];
  }));
  process.exitCode = await supervise(commands, { cwd: root });
}
