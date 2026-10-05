-- Additive feature/security migration. No existing content or credentials are removed.
ALTER TYPE "Role" ADD VALUE 'OWNER';
ALTER TABLE "User" ADD COLUMN "isPrimaryAdmin" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "User_single_primary_admin" ON "User" ("isPrimaryAdmin") WHERE "isPrimaryAdmin" = true;
ALTER TABLE "Item" ADD COLUMN "condition" TEXT;
ALTER TABLE "Location" ADD COLUMN "address" TEXT, ADD COLUMN "latitude" DOUBLE PRECISION, ADD COLUMN "longitude" DOUBLE PRECISION, ADD COLUMN "mapsUrl" TEXT;
ALTER TABLE "Warranty" ADD COLUMN "planType" TEXT, ADD COLUMN "coverage" TEXT, ADD COLUMN "notes" TEXT;
ALTER TABLE "Repair" ADD COLUMN "notes" TEXT;
CREATE TABLE "WarrantyDocument" (
  "id" UUID NOT NULL,
  "warrantyId" UUID NOT NULL,
  "documentId" UUID NOT NULL,
  CONSTRAINT "WarrantyDocument_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WarrantyDocument_warrantyId_fkey" FOREIGN KEY ("warrantyId") REFERENCES "Warranty"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WarrantyDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "WarrantyDocument_warrantyId_documentId_key" ON "WarrantyDocument"("warrantyId", "documentId");
ALTER TABLE "Barcode" ADD COLUMN "revokedAt" TIMESTAMP(3), ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "QrCode" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "PasswordReset" ADD COLUMN "admin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AdminAuditLog" DROP CONSTRAINT "AdminAuditLog_adminId_fkey";
ALTER TABLE "AdminAuditLog" ALTER COLUMN "adminId" DROP NOT NULL;
ALTER TABLE "AdminAuditLog" ADD COLUMN "result" TEXT NOT NULL DEFAULT 'SUCCESS', ADD COLUMN "requestId" TEXT, ADD COLUMN "userAgent" TEXT;
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
