/* global module */
// Append releases newest-first. Verification values describe observed results only.
// CommonJS matches the root package; applications consume this at build/startup.
module.exports.changelog = [
  {
    version: '0.1.2',
    name: 'Production Deployment and Live Authentication Verification',
    date: '2026-10-05',
    changes: [
      'Deploy the stabilized release using the configured production environment.',
      'Initialize the confirmed production database using the existing reviewed migrations and seed.',
      'Verify real production-domain security, provider initialization and service health.',
      'Bound external Redis/PostgreSQL handshakes after reproducing five-second startup timeouts.',
      'Load the existing environment before production build subprocesses.',
    ],
    verification: {
      build: 'PASS', typecheck: 'PASS', lint: 'PASS', tests: 'PASS — 17 passed, 19 integration tests skipped',
      productionDeployment: 'PASS', productionPostgreSQL: 'PASS', productionRedis: 'PASS',
      requestProtection: 'PASS', csrf: 'PARTIAL — unauthenticated/CORS checks passed; authenticated account unavailable', startup: 'PASS',
      googleAuthorizationInitialization: 'PASS', discordAuthorizationInitialization: 'PASS',
      googleOAuth: 'BLOCKED — authorized browser/account unavailable',
      discordOAuth: 'BLOCKED — authorized browser/account unavailable',
      authenticatedSession: 'BLOCKED — actual authenticated account unavailable',
      logoutSessionRevocation: 'BLOCKED — actual authenticated account unavailable',
      smtpDelivery: 'BLOCKED — SMTP_PASSWORD absent',
      administratorProvisioning: 'FAIL — ADMIN_PASSWORD does not satisfy existing policy',
      webHealth: 'PASS', apiHealth: 'PASS', gitSecretCheck: 'PASS',
      verdict: 'FAILED — full authentication verification incomplete',
    },
  },
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
