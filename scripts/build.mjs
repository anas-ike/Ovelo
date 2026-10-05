import { execFileSync } from 'node:child_process';
import process from 'node:process';
import console from 'node:console';

// Load the same ignored environment as production startup before Vite/NPM run.
// Invoke npm's JS entrypoint directly; no shell/process-tree discovery is needed.
if (!process.env.npm_execpath) throw new Error('Run the build through npm run build');
for (const stage of ['shared', 'api', 'worker', 'web']) {
  try {
    execFileSync(process.execPath, [process.env.npm_execpath, 'run', `build:${stage}`], { stdio: 'inherit', env: process.env });
  } catch {
    console.error(`Ovelo build failed at ${stage}`);
    process.exitCode = 1;
    break;
  }
}
