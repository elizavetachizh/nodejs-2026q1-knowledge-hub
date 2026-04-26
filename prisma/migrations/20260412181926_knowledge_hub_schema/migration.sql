-- DropIndex
DROP INDEX "Article_authorId_idx";

-- CreateIndex
CREATE INDEX "Article_status_idx" ON "Article"("status");
