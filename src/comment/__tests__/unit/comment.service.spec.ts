import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { JwtPayload } from 'src/auth/auth.types';
import { UserRole } from 'src/user/dto/create-user.dto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommentService } from 'src/comment/comment.service';

const editorId = '550e8400-e29b-41d4-a716-446655440000';
const articleId = '770e8400-e29b-41d4-a716-446655440000';
const editorActor: JwtPayload = {
  userId: editorId,
  role: UserRole.EDITOR,
  login: 'editor1',
};

const adminActor: JwtPayload = {
  userId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  role: UserRole.ADMIN,
  login: 'admin1',
};

function makePrismaMock() {
  return {
    article: {
      findUnique: vi.fn(),
    },
    comment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
}

let prisma: ReturnType<typeof makePrismaMock>;
let commentService: CommentService;

beforeEach(() => {
  prisma = makePrismaMock();
  commentService = new CommentService(prisma as unknown as PrismaService);
});

function prismaCommentRow(
  overrides: Partial<{
    id: string;
    content: string;
    authorId: string | null;
    articleId: string;
  }>,
) {
  return {
    id: '1',
    content: 'Content 1',
    authorId: editorId,
    articleId,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}
function prismaArticleRow(
  overrides: Partial<{
    id: string;
    title: string;
    content: string;
    authorId: string | null;
  }>,
) {
  return {
    id: articleId,
    title: 'Title 1',
    content: 'Content 1',
    authorId: editorId,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('CommentService', () => {
  it('should return all comments', async () => {
    const mockComments = [prismaCommentRow({})];

    prisma.comment.findMany.mockResolvedValue(mockComments);
    await commentService.getComments(articleId);
    expect(prisma.comment.findMany).toHaveBeenCalledWith({
      where: { articleId },
      include: { author: true },
    });
  });
});

describe('getComment', () => {
  it('should return comment by id', async () => {
    const row = prismaCommentRow({});
    prisma.comment.findUnique.mockResolvedValue(row);

    const result = await commentService.getComment(row.id);

    expect(prisma.comment.findUnique).toHaveBeenCalledWith({
      where: { id: row.id },
    });
    expect(result).toMatchObject({
      id: row.id,
      content: row.content,
      authorId: row.authorId,
      articleId: row.articleId,
    });
    expect(typeof result.createdAt).toBe('number');
  });

  it('getComment throws when not found', async () => {
    prisma.comment.findUnique.mockResolvedValue(null);
    await expect(
      commentService.getComment('550e8400-e29b-41d4-a716-446655440000'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('createComment', () => {
  it('createComment creates comment for editor', async () => {
    const dto = {
      content: 'Content 1',
      articleId,
      authorId: editorId,
    };

    prisma.article.findUnique.mockResolvedValue(
      prismaArticleRow({ id: articleId }),
    );
    prisma.comment.create.mockResolvedValue(
      prismaCommentRow({
        content: dto.content,
        articleId,
        authorId: dto.authorId,
      }),
    );

    await commentService.createComment(dto, editorActor);

    expect(prisma.comment.create).toHaveBeenCalledWith({
      data: {
        content: dto.content,
        articleId: dto.articleId,
        authorId: dto.authorId,
      },
      include: { author: true },
    });
  });

  it('throws when article does not exist', async () => {
    const dto = {
      content: 'Content 1',
      articleId,
      authorId: editorId,
    };
    prisma.article.findUnique.mockResolvedValue(null);

    await expect(
      commentService.createComment(dto, editorActor),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(prisma.comment.create).not.toHaveBeenCalled();
  });

  it('admin can set authorId on create', async () => {
    const otherAuthor = '990e8400-e29b-41d4-a716-446655440000';
    const dto = {
      content: 'Content 1',
      articleId,
      authorId: otherAuthor,
    };
    prisma.article.findUnique.mockResolvedValue(
      prismaArticleRow({ id: articleId }),
    );
    prisma.comment.create.mockResolvedValue(
      prismaCommentRow({
        content: dto.content,
        articleId,
        authorId: otherAuthor,
      }),
    );

    await commentService.createComment(dto, adminActor);

    expect(prisma.comment.create).toHaveBeenCalledWith({
      data: {
        content: dto.content,
        articleId: dto.articleId,
        authorId: otherAuthor,
      },
      include: { author: true },
    });
  });

  it('createComment forbids viewer', async () => {
    const dto = {
      content: 'Content 1',
      articleId,
      authorId: editorId,
    };
    const viewer: JwtPayload = {
      userId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      role: UserRole.VIEWER,
      login: 'viewer1',
    };
    prisma.article.findUnique.mockResolvedValue(
      prismaArticleRow({ id: articleId }),
    );
    await expect(
      commentService.createComment(dto, viewer),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.comment.create).not.toHaveBeenCalled();
  });
});

describe('deleteComment', () => {
  it('throws ForbiddenException when user is viewer', async () => {
    const row = prismaCommentRow({});
    prisma.comment.findUnique.mockResolvedValue(row);

    const viewer: JwtPayload = {
      userId: editorId,
      role: UserRole.VIEWER,
      login: 'viewer1',
    };

    await expect(
      commentService.deleteComment(row.id, viewer),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.comment.delete).not.toHaveBeenCalled();
  });

  it('deletes comment when editor owns it', async () => {
    const row = prismaCommentRow({ authorId: editorId });
    prisma.comment.findUnique.mockResolvedValue(row);

    await commentService.deleteComment(row.id, editorActor);

    expect(prisma.comment.delete).toHaveBeenCalledWith({
      where: { id: row.id },
    });
  });

  it('throws when comment not found', async () => {
    prisma.comment.findUnique.mockResolvedValue(null);
    await expect(
      commentService.deleteComment(
        '550e8400-e29b-41d4-a716-446655440000',
        editorActor,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.comment.delete).not.toHaveBeenCalled();
  });
});

describe('updateComment', () => {
  it('updates comment when editor owns it', async () => {
    const existing = prismaCommentRow({
      id: 'comment-1',
      authorId: editorId,
    });
    prisma.comment.findUnique.mockResolvedValue(existing);

    const updateDto = {
      content: 'Updated content',
    };

    const updatedRow = prismaCommentRow({
      id: existing.id,
      content: updateDto.content,
    });
    prisma.comment.update.mockResolvedValue(updatedRow);

    await commentService.updateComment(existing.id, updateDto, editorActor);

    expect(prisma.comment.update).toHaveBeenCalledWith({
      where: { id: existing.id },
      data: {
        content: updateDto.content,
      },
    });
  });

  it('throws NotFoundException when comment missing', async () => {
    prisma.comment.findUnique.mockResolvedValue(null);

    await expect(
      commentService.updateComment(
        '550e8400-e29b-41d4-a716-446655440000',
        {
          content: 'Updated content',
        },
        editorActor,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.comment.update).not.toHaveBeenCalled();
  });

  it('forbids editor updating another users comment', async () => {
    const existing = prismaCommentRow({
      id: 'comment-1',
      authorId: '990e8400-e29b-41d4-a716-446655440000',
    });
    prisma.comment.findUnique.mockResolvedValue(existing);

    await expect(
      commentService.updateComment(existing.id, { content: 'x' }, editorActor),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.comment.update).not.toHaveBeenCalled();
  });

  it('forbids editor updating comment without author', async () => {
    const existing = prismaCommentRow({
      id: 'comment-1',
      authorId: null,
    });
    prisma.comment.findUnique.mockResolvedValue(existing);

    await expect(
      commentService.updateComment(existing.id, { content: 'x' }, editorActor),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
