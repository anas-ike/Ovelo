import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import process from 'node:process';
import { once } from 'node:events';
import { setTimeout } from 'node:timers/promises';
import { supervise } from '../scripts/start.mjs';
import { URL } from 'node:url';

const moduleUrl = new URL('../scripts/start.mjs', import.meta.url).href;
function launch(commands, options = {}) {
  return spawn(process.execPath, ['--input-type=module', '-e', `import { supervise } from ${JSON.stringify(moduleUrl)}; process.exitCode = await supervise(${JSON.stringify(commands)}, ${JSON.stringify(options)});`], { env: { ...process.env, PATH: '' }, stdio: ['ignore','pipe','pipe'] });
}

for (const signal of ['SIGTERM','SIGINT']) {
  test(`supervisor closes all children on ${signal} with no ps or shell in PATH`, { timeout: 10000 }, async () => {
    const source = `console.log('ready'); process.on('${signal}', () => {console.log('closed'); process.exit(0)}); setInterval(()=>{},1000);`;
    const supervisor = launch({ api: ['-e', source], worker: ['-e', source], web: ['-e', source] });
    let output = ''; let errors = '';
    supervisor.stdout.on('data', (data) => { output += data; }); supervisor.stderr.on('data', (data) => { errors += data; });
    try {
      for (let i=0; i<100 && output.split('ready').length < 4; i++) await setTimeout(30);
      assert.equal(output.split('ready').length, 4);
      const closed = once(supervisor, 'close'); supervisor.kill(signal);
      const [code] = await closed;
      assert.equal(code, 0); assert.equal(output.split('closed').length, 4); assert.equal(errors, '');
    } finally { supervisor.kill('SIGKILL'); }
  });
}
test('unexpected process failure stops siblings and exits nonzero', { timeout: 10000 }, async () => {
  const supervisor = launch({ api: ['-e', 'setTimeout(()=>process.exit(7),200)'], worker: ['-e', "process.on('SIGTERM',()=>{console.log('worker closed');process.exit(0)});setInterval(()=>{},1000)"] });
  let output=''; let errors=''; supervisor.stdout.on('data',(data)=>{output+=data}); supervisor.stderr.on('data',(data)=>{errors+=data});
  const [code] = await once(supervisor,'close');
  assert.equal(code,7); assert.match(output,/worker closed/); assert.match(errors,/exited unexpectedly/); assert.doesNotMatch(errors,/spawn ps/);
});
test('spawn errors are handled rather than unhandled ChildProcess events', { timeout: 10000 }, async () => {
  const code = await supervise({ api: ['-e',''] }, { cwd: '/directory-that-does-not-exist-ovelo' });
  assert.equal(code, 1);
});
