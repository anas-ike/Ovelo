/* global module */
// Append releases newest-first. Verification values describe observed results only.
// CommonJS matches the root package; applications consume this at build/startup.
module.exports.changelog = [
  {
    version: '0.1.1',
    name: 'Production Authentication Stabilization',
    date: '2026-10-05',
    changes: [
      'Replace production process-tree shutdown with direct Node supervision.',
      'Share verified Redis TLS/SNI options and bounded readiness across security and queues.',
      'Connect Google and Discord controls to safe provider capabilities and session-bound CSRF.',
      'Add versioned build metadata and evidence-based production verification.',
    ],
    verification: {
      build: 'PASS',
      typecheck: 'PASS',
      lint: 'PASS',
      tests: 'PASS',
      googleOAuth: 'FAIL',
      discordOAuth: 'FAIL',
      productionRedis: 'PASS',
      productionPostgreSQL: 'FAIL',
      productionEnvironment: 'FAIL',
      isolatedProductionStartup: 'PASS',
      productionStartup: 'NOT_DEPLOYED',
      productionHealth: 'PASS',
      productionAuthentication: 'FAIL',
    },
  },
  {
    version: '0.1.0',
    name: 'Initial Ovelo Application and Pterodactyl Deployment',
    date: null,
    changes: ['Existing application baseline through commit 1dc18a5.'],
    verification: { historicalChecks: 'NOT_RECORDED' },
  },
];
