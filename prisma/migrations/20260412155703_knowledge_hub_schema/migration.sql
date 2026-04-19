-- DropIndex
DROP INDEX "User_login_key";

-- CreateIndex
CREATE INDEX "Article_authorId_idx" ON "Article"("authorId");

-- CreateIndex
CREATE INDEX "Article_categoryId_idx" ON "Article"("categoryId");
