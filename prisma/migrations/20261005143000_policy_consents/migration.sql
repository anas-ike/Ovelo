-- Store explicit, versioned policy acknowledgements without changing existing accounts or records.
CREATE TABLE "PolicyConsent" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "policy" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PolicyConsent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PolicyConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PolicyConsent_userId_policy_version_key" ON "PolicyConsent"("userId", "policy", "version");
CREATE INDEX "PolicyConsent_userId_policy_idx" ON "PolicyConsent"("userId", "policy");
