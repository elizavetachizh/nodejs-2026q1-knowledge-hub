import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { ArticleService } from 'src/article/article.service';
import { JwtPayload } from 'src/auth/auth.types';
import { UserRole } from 'src/user/dto/create-user.dto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { toPrismaStatus } from 'src/article/utils/article.mapper';
import { ArticleStatus } from 'src/article/dto/create-article.dto';
import { ArticleStatus as PrismaArticleStatus } from 'generated/prisma/enums';

const editorId = '550e8400-e29b-41d4-a716-446655440000';
const categoryId = '660e8400-e29b-41d4-a716-446655440000';

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

const otherAuthorId = '990e8400-e29b-41d4-a716-446655440000';

function makePrismaMock() {
  return {
    article: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
}

let prisma: ReturnType<typeof makePrismaMock>;
let articleService: ArticleService;

beforeEach(() => {
  prisma = makePrismaMock();
  articleService = new ArticleService(prisma as unknown as PrismaService);
});

function prismaArticleRow(
  overrides: Partial<{
    id: string;
    title: string;
    content: string;
    status: PrismaArticleStatus;
    authorId: string | null;
    categoryId: string | null;
    tags: { name: string }[];
  }>,
) {
  return {
    id: '1',
    title: 'Article 1',
    content: 'Content 1',
    status: PrismaArticleStatus.DRAFT,
    authorId: editorId,
    categoryId,
    tags: [{ name: 'tag1' }, { name: 'tag2' }],
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-02T00:00:00Z'),
    ...overrides,
  };
}

describe('ArticleService', () => {
  it('should return all articles', async () => {
    const mockArticles = [prismaArticleRow({})];

    prisma.article.findMany.mockResolvedValue(mockArticles);
    await articleService.getArticles();
    expect(prisma.article.findMany).toHaveBeenCalledWith({
      where: {},
      include: { tags: true },
    });
  });

  it('getArticles builds where filter', async () => {
    prisma.article.findMany.mockResolvedValue([]);
    await articleService.getArticles(undefined, categoryId, undefined);
    expect(prisma.article.findMany).toHaveBeenCalledWith({
      where: { categoryId },
      include: { tags: true },
    });
  });

  it('getArticles combines status, categoryId, and tag filters', async () => {
    prisma.article.findMany.mockResolvedValue([]);
    await articleService.getArticles(
      ArticleStatus.PUBLISHED,
      categoryId,
      'news',
    );
    expect(prisma.article.findMany).toHaveBeenCalledWith({
      where: {
        status: toPrismaStatus(ArticleStatus.PUBLISHED),
        categoryId,
        tags: { some: { name: 'news' } },
      },
      include: { tags: true },
    });
  });
});

describe('getArticle', () => {
  it('should return article by id', async () => {
    const row = prismaArticleRow({ tags: [] });
    prisma.article.findUnique.mockResolvedValue(row);

    const result = await articleService.getArticle(row.id);

    expect(prisma.article.findUnique).toHaveBeenCalledWith({
      where: { id: row.id },
      include: { tags: true },
    });
    expect(result).toMatchObject({
      id: row.id,
      title: row.title,
      content: row.content,
      status: ArticleStatus.DRAFT,
      authorId: editorId,
      categoryId,
      tags: [],
    });
    expect(typeof result.createdAt).toBe('number');
  });

  it('getArticle throws when not found', async () => {
    prisma.article.findUnique.mockResolvedValue(null);
    await expect(
      articleService.getArticle('550e8400-e29b-41d4-a716-446655440000'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('createArticle', () => {
  it('createArticle creates article for editor', async () => {
    const dto = {
      title: 'Article 1',
      content: 'Content 1',
      status: ArticleStatus.DRAFT,
      tags: ['tag1', 'tag2'],
      authorId: editorId,
      categoryId,
    };

    prisma.article.create.mockResolvedValue(
      prismaArticleRow({
        title: dto.title,
        content: dto.content,
      }),
    );

    await articleService.createArticle(dto, editorActor);

    expect(prisma.article.create).toHaveBeenCalledWith({
      data: {
        title: dto.title,
        content: dto.content,
        authorId: editorActor.userId,
        status: toPrismaStatus(dto.status),
        categoryId: dto.categoryId,
        tags: {
          connectOrCreate: ['tag1', 'tag2'].map((tag) => ({
            where: { name: tag },
            create: { name: tag },
          })),
        },
      },
      include: { tags: true },
    });
  });

  it('createArticle dedupes and trims tags', async () => {
    const dto = {
      title: 'Article 1',
      content: 'Content 1',
      status: ArticleStatus.DRAFT,
      tags: [' tag1 ', 'tag1', 'tag2', ''],
      authorId: editorId,
      categoryId,
    };

    prisma.article.create.mockResolvedValue(
      prismaArticleRow({
        title: dto.title,
        content: dto.content,
      }),
    );

    await articleService.createArticle(dto, editorActor);

    expect(prisma.article.create).toHaveBeenCalledWith({
      data: {
        title: dto.title,
        content: dto.content,
        authorId: editorActor.userId,
        status: toPrismaStatus(dto.status),
        categoryId: dto.categoryId,
        tags: {
          connectOrCreate: ['tag1', 'tag2'].map((tag) => ({
            where: { name: tag },
            create: { name: tag },
          })),
        },
      },
      include: { tags: true },
    });
  });

  it('createArticle forbids viewer', async () => {
    const dto = {
      title: 'Article 1',
      content: 'Content 1',
      authorId: editorId,
      categoryId,
      tags: ['tag1'],
    };
    const viewer: JwtPayload = {
      userId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      role: UserRole.VIEWER,
      login: 'viewer1',
    };

    expect(() => articleService.createArticle(dto, viewer)).toThrow(
      ForbiddenException,
    );
    expect(prisma.article.create).not.toHaveBeenCalled();
  });

  it('admin create keeps authorId from dto', async () => {
    const dto = {
      title: 'Article 1',
      content: 'Content 1',
      status: ArticleStatus.DRAFT,
      authorId: otherAuthorId,
      categoryId,
      tags: [] as string[],
    };
    prisma.article.create.mockResolvedValue(
      prismaArticleRow({
        title: dto.title,
        authorId: otherAuthorId,
      }),
    );

    await articleService.createArticle(dto, adminActor);

    expect(prisma.article.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          authorId: otherAuthorId,
        }),
      }),
    );
  });
});

describe('deleteArticle', () => {
  it('throws ForbiddenException when user is viewer', async () => {
    const row = prismaArticleRow({});
    prisma.article.findUnique.mockResolvedValue(row);

    const viewer: JwtPayload = {
      userId: editorId,
      role: UserRole.VIEWER,
      login: 'viewer1',
    };

    await expect(
      articleService.deleteArticle(row.id, viewer),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.article.delete).not.toHaveBeenCalled();
  });

  it('deletes article when editor owns it', async () => {
    const row = prismaArticleRow({ authorId: editorId });
    prisma.article.findUnique.mockResolvedValue(row);

    await articleService.deleteArticle(row.id, editorActor);

    expect(prisma.article.delete).toHaveBeenCalledWith({
      where: { id: row.id },
    });
  });

  it('throws when article not found', async () => {
    prisma.article.findUnique.mockResolvedValue(null);
    await expect(
      articleService.deleteArticle(
        '550e8400-e29b-41d4-a716-446655440000',
        editorActor,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.article.delete).not.toHaveBeenCalled();
  });
});

describe('updateArticle', () => {
  it('updates article when editor owns it', async () => {
    const existing = prismaArticleRow({
      id: 'article-1',
      authorId: editorId,
    });
    prisma.article.findUnique.mockResolvedValue(existing);

    const updateDto = {
      title: 'Updated title',
      content: 'Updated body',
      authorId: editorId,
      categoryId,
      tags: ['tag1', 'tag2'],
    };

    const updatedRow = prismaArticleRow({
      id: existing.id,
      title: updateDto.title,
      content: updateDto.content,
    });
    prisma.article.update.mockResolvedValue(updatedRow);

    await articleService.updateArticle(existing.id, updateDto, editorActor);

    expect(prisma.article.update).toHaveBeenCalledWith({
      where: { id: existing.id },
      data: {
        title: updateDto.title,
        content: updateDto.content,
        authorId: editorId,
        categoryId: updateDto.categoryId,
        tags: {
          set: [],
          connectOrCreate: updateDto.tags.map((tag) => ({
            where: { name: tag },
            create: { name: tag },
          })),
        },
      },
      include: { tags: true },
    });
  });

  it('forbids editor from reassigning authorId to another user', async () => {
    const existing = prismaArticleRow({
      id: 'article-1',
      authorId: editorId,
    });
    prisma.article.findUnique.mockResolvedValue(existing);

    await expect(
      articleService.updateArticle(
        existing.id,
        {
          title: 't',
          content: 'c',
          authorId: otherAuthorId,
          categoryId,
          tags: ['x'],
        },
        editorActor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.article.update).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when article missing', async () => {
    prisma.article.findUnique.mockResolvedValue(null);

    await expect(
      articleService.updateArticle(
        '550e8400-e29b-41d4-a716-446655440000',
        {
          title: 'Article 1',
          content: 'Content 1',
          authorId: editorId,
          categoryId,
          tags: ['tag1'],
        },
        editorActor,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.article.update).not.toHaveBeenCalled();
  });

  it('allows draft → published', async () => {
    const existing = prismaArticleRow({
      id: 'article-1',
      authorId: editorId,
      status: PrismaArticleStatus.DRAFT,
    });
    prisma.article.findUnique.mockResolvedValue(existing);
    prisma.article.update.mockResolvedValue(
      prismaArticleRow({
        ...existing,
        status: PrismaArticleStatus.PUBLISHED,
      }),
    );

    await articleService.updateArticle(
      existing.id,
      {
        title: existing.title,
        content: existing.content,
        status: ArticleStatus.PUBLISHED,
        authorId: editorId,
        categoryId,
        tags: ['tag1'],
      },
      editorActor,
    );

    expect(prisma.article.update).toHaveBeenCalled();
  });

  it('allows published → archived', async () => {
    const existing = prismaArticleRow({
      id: 'article-1',
      authorId: editorId,
      status: PrismaArticleStatus.PUBLISHED,
    });
    prisma.article.findUnique.mockResolvedValue(existing);
    prisma.article.update.mockResolvedValue(
      prismaArticleRow({
        ...existing,
        status: PrismaArticleStatus.ARCHIVED,
      }),
    );

    await articleService.updateArticle(
      existing.id,
      {
        title: existing.title,
        content: existing.content,
        status: ArticleStatus.ARCHIVED,
        authorId: editorId,
        categoryId,
        tags: ['tag1'],
      },
      editorActor,
    );

    expect(prisma.article.update).toHaveBeenCalled();
  });

  it('rejects published → draft', async () => {
    const existing = prismaArticleRow({
      id: 'article-1',
      authorId: editorId,
      status: PrismaArticleStatus.PUBLISHED,
    });
    prisma.article.findUnique.mockResolvedValue(existing);

    await expect(
      articleService.updateArticle(
        existing.id,
        {
          title: existing.title,
          content: existing.content,
          status: ArticleStatus.DRAFT,
          authorId: editorId,
          categoryId,
          tags: ['tag1'],
        },
        editorActor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.article.update).not.toHaveBeenCalled();
  });

  it('rejects draft → archived', async () => {
    const existing = prismaArticleRow({
      id: 'article-1',
      authorId: editorId,
      status: PrismaArticleStatus.DRAFT,
    });
    prisma.article.findUnique.mockResolvedValue(existing);

    await expect(
      articleService.updateArticle(
        existing.id,
        {
          title: existing.title,
          content: existing.content,
          status: ArticleStatus.ARCHIVED,
          authorId: editorId,
          categoryId,
          tags: ['tag1'],
        },
        editorActor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.article.update).not.toHaveBeenCalled();
  });

  it('rejects any transition from archived', async () => {
    const existing = prismaArticleRow({
      id: 'article-1',
      authorId: editorId,
      status: PrismaArticleStatus.ARCHIVED,
    });
    prisma.article.findUnique.mockResolvedValue(existing);

    await expect(
      articleService.updateArticle(
        existing.id,
        {
          title: existing.title,
          content: existing.content,
          status: ArticleStatus.PUBLISHED,
          authorId: editorId,
          categoryId,
          tags: ['tag1'],
        },
        editorActor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.article.update).not.toHaveBeenCalled();
  });
});
