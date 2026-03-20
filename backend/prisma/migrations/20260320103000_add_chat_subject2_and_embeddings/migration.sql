ALTER TABLE "Chat" ADD COLUMN "subject2" TEXT;

ALTER TABLE "KnowledgeItem" ADD COLUMN "embedding" TEXT;

CREATE INDEX "Chat_userId_subject_subject2_idx" ON "Chat"("userId", "subject", "subject2");

CREATE INDEX "VisitLog_action_createdAt_idx" ON "VisitLog"("action", "createdAt");

CREATE INDEX "VisitLog_userId_action_createdAt_idx" ON "VisitLog"("userId", "action", "createdAt");

CREATE INDEX "KnowledgeItem_subject_createdAt_idx" ON "KnowledgeItem"("subject", "createdAt");
