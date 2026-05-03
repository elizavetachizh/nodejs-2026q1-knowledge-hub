import { UnprocessableEntityError } from 'src/common/errors/app-http.error';
import { CommentService } from './comment.service';

describe('CommentService', () => {
  it('should throw 422 when creating comment for missing article', () => {
    const articleService = {
      findArticleById: jest.fn().mockReturnValue(undefined),
    };
    const service = new CommentService(articleService as any);

    expect(() =>
      service.createComment({
        content: 'Hello',
        articleId: '0a35dd62-e09f-444b-a628-f4e7c6954f57',
        authorId: null,
      }),
    ).toThrow(UnprocessableEntityError);
  });
});
