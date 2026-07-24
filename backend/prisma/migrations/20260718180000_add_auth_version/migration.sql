-- Security epoch for immediate JWT revocation after password or privilege changes.
ALTER TABLE "User"
ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 0;
