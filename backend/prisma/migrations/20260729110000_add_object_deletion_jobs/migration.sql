CREATE TABLE IF NOT EXISTS "ObjectDeletionJob" (
    "id" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseExpiresAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObjectDeletionJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ObjectDeletionJob_objectKey_key"
ON "ObjectDeletionJob"("objectKey");

CREATE INDEX IF NOT EXISTS "ObjectDeletionJob_status_nextAttemptAt_idx"
ON "ObjectDeletionJob"("status", "nextAttemptAt");

CREATE INDEX IF NOT EXISTS "ObjectDeletionJob_status_leaseExpiresAt_idx"
ON "ObjectDeletionJob"("status", "leaseExpiresAt");
