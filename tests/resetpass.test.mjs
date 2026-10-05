import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Buffer } from 'node:buffer';
import { promptSecret } from '../scripts/resetpass.mjs';

function terminal() {
  const input = new EventEmitter();
  input.isTTY = true; input.raw = false;
  input.setRawMode = value => { input.raw = value; };
  input.resume = () => {}; input.pause = () => {};
  let text = ''; const output = { write: value => { text += value; } };
  return { input, output, text: () => text };
}
test('CLI password prompt never echoes input and restores terminal mode', async () => {
  const t = terminal(); const result = promptSecret('New password: ', t.input, t.output);
  assert.equal(t.input.raw, true);
  t.input.emit('data', Buffer.from('confidential-password-x\u007fy\r'));
  assert.equal(await result, 'confidential-password-y');
  assert.equal(t.text(), 'New password: \n'); assert.equal(t.input.raw, false);
  assert.equal(t.input.listenerCount('data'), 0);
});
test('CLI prompt rejects piped input and cleans up after cancellation', async () => {
  assert.throws(() => promptSecret('Password: ', { isTTY: false }), /interactive terminal/);
  const t = terminal(); const result = promptSecret('Password: ', t.input, t.output);
  t.input.emit('data', Buffer.from('hidden-input\u0003'));
  await assert.rejects(result, /cancelled/);
  assert.equal(t.input.raw, false); assert.equal(t.text(), 'Password: \n');
  assert.equal(t.input.listenerCount('data'), 0);
});
