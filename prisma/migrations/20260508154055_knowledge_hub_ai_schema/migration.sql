-- CreateEnum
CREATE TYPE "ConversationUserRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "RagConversationMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "ConversationUserRole" NOT NULL DEFAULT 'USER',
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RagConversationMessage_pkey" PRIMARY KEY ("conversationId")
);

-- CreateIndex
CREATE INDEX "RagConversationMessage_conversationId_idx" ON "RagConversationMessage"("conversationId");

-- CreateIndex
CREATE INDEX "RagConversationMessage_createdAt_idx" ON "RagConversationMessage"("createdAt");
