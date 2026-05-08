/*
  Warnings:

  - The primary key for the `RagConversationMessage` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "RagConversationMessage" DROP CONSTRAINT "RagConversationMessage_pkey",
ADD CONSTRAINT "RagConversationMessage_pkey" PRIMARY KEY ("id");
