import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { version } = require('../../../package.json') as { version: string };
const { changelog } = require('../../../CHANGELOG.js') as {
  changelog: { version: string; name: string; date: string | null }[];
};
const current = changelog[0];
if (!current || current.version !== version) throw new Error('Release metadata does not match package version');
export const release = Object.freeze({ version, name: current.name, date: current.date });
