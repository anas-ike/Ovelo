import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import releases from '../CHANGELOG.js';
import { URL } from 'node:url';

test('application version, release registry and permanent reports stay in sync', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const current = releases.changelog[0];
  assert.equal(current.version, pkg.version);
  assert.equal(new Set(releases.changelog.map((entry) => entry.version)).size, releases.changelog.length);
  const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
  const report = readFileSync(new URL('../docs/production-verification.md', import.meta.url), 'utf8');
  assert.ok(changelog.includes(`## v${pkg.version} — ${current.name}`));
  assert.ok(report.includes(`Ovelo v${pkg.version} — ${current.name}`));
});
