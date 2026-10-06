ALTER TABLE "User"
ADD COLUMN "avatarStorageObjectId" UUID;

CREATE UNIQUE INDEX "User_avatarStorageObjectId_key" ON "User"("avatarStorageObjectId");

ALTER TABLE "User"
ADD CONSTRAINT "User_avatarStorageObjectId_fkey"
FOREIGN KEY ("avatarStorageObjectId") REFERENCES "StorageObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PremiumCode" (
    "id" UUID NOT NULL,
    "codeHash" TEXT NOT NULL,
    "codeLastFour" VARCHAR(8) NOT NULL,
    "planId" UUID NOT NULL,
    "createdById" UUID,
    "redeemedById" UUID,
    "redeemedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PremiumCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PremiumCode_codeHash_key" ON "PremiumCode"("codeHash");
CREATE INDEX "PremiumCode_redeemedAt_idx" ON "PremiumCode"("redeemedAt");
CREATE INDEX "PremiumCode_createdAt_idx" ON "PremiumCode"("createdAt");

ALTER TABLE "PremiumCode"
ADD CONSTRAINT "PremiumCode_planId_fkey"
FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PremiumCode"
ADD CONSTRAINT "PremiumCode_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PremiumCode"
ADD CONSTRAINT "PremiumCode_redeemedById_fkey"
FOREIGN KEY ("redeemedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
