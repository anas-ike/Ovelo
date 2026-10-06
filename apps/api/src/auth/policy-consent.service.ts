import { policyVersions } from '@ovelo/validation';
import { prisma } from '../database/prisma.js';
import { AppError } from '../middleware/error.js';

export type PolicyName = 'TERMS' | 'PRIVACY' | 'UPLOAD_PROCESSING';
type ConsentInput = {
  termsVersion?: string;
  privacyVersion?: string;
  uploadProcessingVersion?: string;
};

const currentVersions: Record<PolicyName, string> = {
  TERMS: policyVersions.terms,
  PRIVACY: policyVersions.privacy,
  UPLOAD_PROCESSING: policyVersions.uploadProcessing,
};

function inputVersion(input: ConsentInput, policy: PolicyName) {
  return policy === 'TERMS'
    ? input.termsVersion
    : policy === 'PRIVACY'
      ? input.privacyVersion
      : input.uploadProcessingVersion;
}

function policyLabel(policy: PolicyName) {
  return policy === 'TERMS'
    ? 'Terms of Service'
    : policy === 'PRIVACY'
      ? 'Privacy Policy'
      : 'upload processing acknowledgement';
}

export async function currentPolicyStatus(userId: string) {
  const accepted = await prisma.policyConsent.findMany({
    where: { userId, policy: { in: Object.keys(currentVersions) } },
    select: { policy: true, version: true },
  });
  const has = (policy: PolicyName) =>
    accepted.some((entry) => entry.policy === policy && entry.version === currentVersions[policy]);
  return {
    versions: policyVersions,
    accepted: {
      terms: has('TERMS'),
      privacy: has('PRIVACY'),
      uploadProcessing: has('UPLOAD_PROCESSING'),
    },
    missing: (Object.keys(currentVersions) as PolicyName[]).filter((policy) => !has(policy)),
  };
}

export async function requireCurrentPolicyConsent(
  userId: string,
  input: ConsentInput,
  required: PolicyName[],
) {
  const status = await currentPolicyStatus(userId);
  const missing = required.filter((policy) => status.missing.includes(policy));
  if (!missing.length) return;
  if (!missing.every((policy) => inputVersion(input, policy) === currentVersions[policy])) {
    throw new AppError(
      428,
      'POLICY_CONSENT_REQUIRED',
      `Accept the current ${missing.map(policyLabel).join(' and ')} before continuing.`,
      { policies: missing, versions: policyVersions },
    );
  }
  await prisma.policyConsent.createMany({
    data: missing.map((policy) => ({ userId, policy, version: currentVersions[policy] })),
    skipDuplicates: true,
  });
}

export function assertPolicyVersions(input: ConsentInput, required: PolicyName[]) {
  const missing = required.filter(
    (policy) => inputVersion(input, policy) !== currentVersions[policy],
  );
  if (missing.length)
    throw new AppError(
      428,
      'POLICY_CONSENT_REQUIRED',
      `Accept the current ${missing.map(policyLabel).join(' and ')} before continuing.`,
      { policies: missing, versions: policyVersions },
    );
}

export { currentVersions };
