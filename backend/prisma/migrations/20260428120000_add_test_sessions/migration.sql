-- Server-side time limit enforcement for public/private test attempts.
CREATE TABLE "TestSession" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shareLink" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TestSession_testId_userId_key" ON "TestSession"("testId", "userId");
CREATE INDEX "TestSession_userId_expiresAt_idx" ON "TestSession"("userId", "expiresAt");
CREATE INDEX "TestSession_testId_expiresAt_idx" ON "TestSession"("testId", "expiresAt");

ALTER TABLE "TestSession"
ADD CONSTRAINT "TestSession_testId_fkey"
FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TestSession"
ADD CONSTRAINT "TestSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
