import { Comment } from '../comment.types';

export function toCommentDto(row: {
  id: string;
  content: string;
  authorId: string | null;
  articleId: string;
  createdAt: Date;
}): Comment {
  return {
    id: row.id,
    content: row.content,
    authorId: row.authorId,
    articleId: row.articleId,
    createdAt: row.createdAt.getTime(),
  };
}
