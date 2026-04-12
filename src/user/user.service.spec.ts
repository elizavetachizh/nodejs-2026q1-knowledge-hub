import { UserService } from './user.service';
import { UserRole } from './dto/create-user.dto';

describe('UserService', () => {
  it('should cascade delete to article and comment services', () => {
    const commentService = {
      deleteCommentByAuthorId: jest.fn(),
    };
    const articleService = {
      clearAuthorId: jest.fn(),
    };
    const service = new UserService(
      commentService as any,
      articleService as any,
    );

    const created = service.create({
      login: 'cascade-user',
      password: 'secret',
      role: UserRole.VIEWER,
    });

    service.delete(created.id);

    expect(commentService.deleteCommentByAuthorId).toHaveBeenCalledWith(
      created.id,
    );
    expect(articleService.clearAuthorId).toHaveBeenCalledWith(created.id);
    expect(service.getUsers()).toHaveLength(0);
  });
});
