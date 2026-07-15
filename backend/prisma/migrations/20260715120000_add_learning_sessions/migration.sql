CREATE TABLE "LearningSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chatId" TEXT,
    "subject" TEXT,
    "topic" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "stage" TEXT NOT NULL DEFAULT 'PREREQUISITE',
    "stepIndex" INTEGER NOT NULL DEFAULT 0,
    "plan" TEXT NOT NULL,
    "prerequisites" TEXT,
    "prerequisiteState" TEXT,
    "masteryState" TEXT,
    "lastCheckpoint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningSession_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AiTestSession"
ADD COLUMN "learningSessionId" TEXT,
ADD COLUMN "purpose" TEXT;

ALTER TABLE "TestQuestion"
ADD COLUMN "answerSource" TEXT,
ADD COLUMN "answerVerified" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "LearningSession_userId_status_updatedAt_idx" ON "LearningSession"("userId", "status", "updatedAt");
CREATE INDEX "LearningSession_chatId_status_idx" ON "LearningSession"("chatId", "status");
CREATE INDEX "LearningSession_userId_topic_status_idx" ON "LearningSession"("userId", "topic", "status");
CREATE INDEX "AiTestSession_learningSessionId_idx" ON "AiTestSession"("learningSessionId");

ALTER TABLE "LearningSession"
ADD CONSTRAINT "LearningSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LearningSession"
ADD CONSTRAINT "LearningSession_chatId_fkey"
FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AiTestSession"
ADD CONSTRAINT "AiTestSession_learningSessionId_fkey"
FOREIGN KEY ("learningSessionId") REFERENCES "LearningSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
