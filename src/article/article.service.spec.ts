import { ArticleService } from './article.service';

describe('ArticleService', () => {
  it('should apply default status and tags on create', () => {
    const commentService = {
      deleteCommentByArticleId: jest.fn(),
    };
    const service = new ArticleService(commentService as any);

    const article = service.createArticle({
      title: 'Default status article',
      content: 'Body',
      authorId: null,
      categoryId: null,
    } as any);

    expect(article.status).toBe('draft');
    expect(article.tags).toEqual([]);
  });
});
