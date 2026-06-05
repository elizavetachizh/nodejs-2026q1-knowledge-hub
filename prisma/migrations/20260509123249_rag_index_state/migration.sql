-- CreateTable
CREATE TABLE "RagIndexState" (
    "articleId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "indexedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RagIndexState_pkey" PRIMARY KEY ("articleId")
);

-- CreateIndex
CREATE INDEX "RagIndexState_indexedAt_idx" ON "RagIndexState"("indexedAt");
