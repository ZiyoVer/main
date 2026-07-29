-- Provider-aware Google identity. Existing password accounts remain configured.
ALTER TABLE "User"
ADD COLUMN "googleSubject" TEXT,
ADD COLUMN "passwordConfigured" BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX "User_googleSubject_key" ON "User"("googleSubject");
