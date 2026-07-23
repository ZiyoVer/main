-- AI test answer keys must originate from a persisted server assistant message.
-- Existing client-created sessions remain NULL and are rejected on submit.
ALTER TABLE "AiTestSession"
ADD COLUMN "sourceMessageId" TEXT;

CREATE UNIQUE INDEX "AiTestSession_sourceMessageId_key"
ON "AiTestSession"("sourceMessageId");

ALTER TABLE "AiTestSession"
ADD CONSTRAINT "AiTestSession_sourceMessageId_fkey"
FOREIGN KEY ("sourceMessageId") REFERENCES "Message"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
