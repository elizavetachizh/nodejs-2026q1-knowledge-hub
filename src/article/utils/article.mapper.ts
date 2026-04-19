import { Article } from '../article.types';
import { ArticleStatus } from '../dto/create-article.dto';
import { ArticleStatus as PrismaArticleStatus } from '../../../generated/prisma/enums';

export function toPrismaStatus(status?: ArticleStatus): PrismaArticleStatus {
  switch (status) {
    case ArticleStatus.PUBLISHED:
      return PrismaArticleStatus.PUBLISHED;
    case ArticleStatus.ARCHIVED:
      return PrismaArticleStatus.ARCHIVED;
    case ArticleStatus.DRAFT:
    default:
      return PrismaArticleStatus.DRAFT;
  }
}
export function fromPrismaStatus(status: PrismaArticleStatus): ArticleStatus {
  switch (status) {
    case PrismaArticleStatus.PUBLISHED:
      return ArticleStatus.PUBLISHED;
    case PrismaArticleStatus.ARCHIVED:
      return ArticleStatus.ARCHIVED;
    case PrismaArticleStatus.DRAFT:
    default:
      return ArticleStatus.DRAFT;
  }
}
export function toArticleDto(row: {
  id: string;
  title: string;
  content: string;
  status: PrismaArticleStatus;
  authorId: string | null;
  categoryId: string | null;
  createdAt: Date;
  updatedAt: Date;
  tags: Array<{ name: string }>;
}): Article {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    status: fromPrismaStatus(row.status),
    authorId: row.authorId,
    categoryId: row.categoryId,
    tags: row.tags.map((t) => t.name),
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}
