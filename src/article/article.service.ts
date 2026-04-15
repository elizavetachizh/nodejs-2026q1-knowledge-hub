import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Article } from './article.types';
import { ArticleStatus, CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { PrismaService } from 'prisma/prisma.service';
import { toArticleDto, toPrismaStatus } from './utils/article.mapper';
import { UserRole } from 'src/user/dto/create-user.dto';
import { JwtPayload } from 'src/auth/auth.types';

@Injectable()
export class ArticleService {
  constructor(private readonly prisma: PrismaService) {}

  private assertEditorOwnsArticle(actor: JwtPayload, authorId: string | null) {
    if (actor.role === UserRole.ADMIN) return;
    if (actor.role === UserRole.EDITOR) {
      if (!authorId) {
        throw new ForbiddenException(
          'Editor can not modify article without author',
        );
      }
      if (authorId !== actor.userId) {
        throw new ForbiddenException('Editor can modify only own articles');
      }
      return;
    }

    throw new ForbiddenException('Insufficient permissions');
  }
  async getArticles(
    status?: ArticleStatus,
    categoryId?: string,
    tag?: string,
  ): Promise<Article[]> {
    const raws = await this.prisma.article.findMany({
      where: {
        ...(status ? { status: toPrismaStatus(status) } : {}),
        ...(categoryId ? { categoryId } : {}),
        ...(tag ? { tags: { some: { name: tag } } } : {}),
      },
      include: {
        tags: true,
      },
    });
    return raws.map((row) => toArticleDto(row));
  }

  async getArticle(id: string): Promise<Article> {
    const row = await this.prisma.article.findUnique({
      where: { id },
      include: {
        tags: true,
      },
    });
    if (!row) throw new NotFoundException(`Article with id ${id} not found`);

    return toArticleDto(row);
  }

  async createArticle(
    createArticleDto: CreateArticleDto,
    actor: JwtPayload,
  ): Promise<Article> {
    let finalAuthorId: string;
    if (actor.role === UserRole.ADMIN) {
      finalAuthorId = createArticleDto.authorId;
    } else if (actor.role === UserRole.EDITOR) {
      finalAuthorId = actor.userId;
    } else {
      throw new ForbiddenException('Insufficient permissions');
    }
    this.assertEditorOwnsArticle(actor, finalAuthorId);

    const row = await this.prisma.article.create({
      data: {
        title: createArticleDto.title,
        content: createArticleDto.content,
        authorId: finalAuthorId,
        categoryId: createArticleDto.categoryId,
        status: toPrismaStatus(createArticleDto.status),
        tags: {
          connectOrCreate: createArticleDto.tags?.map((tag) => ({
            where: { name: tag },
            create: { name: tag },
          })),
        },
      },
      include: {
        tags: true,
      },
    });

    return toArticleDto(row);
  }

  async updateArticle(
    id: string,
    updateArticleDto: UpdateArticleDto,
    actor: JwtPayload,
  ): Promise<Article> {
    const article = await this.prisma.article.findUnique({
      where: { id },
    });
    if (!article)
      throw new NotFoundException(`Article with id ${id} not found`);

    this.assertEditorOwnsArticle(actor, article.authorId);

    if (
      actor.role === UserRole.EDITOR &&
      updateArticleDto.authorId &&
      updateArticleDto.authorId !== actor.userId
    ) {
      throw new ForbiddenException('Insufficient permissions');
    }
    let finalAuthorId: string | null = null;
    if (actor.role === UserRole.ADMIN) {
      finalAuthorId = updateArticleDto.authorId;
    } else if (actor.role === UserRole.EDITOR) {
      finalAuthorId = actor.userId;
    }
    const row = await this.prisma.article.update({
      where: { id },
      data: {
        title: updateArticleDto.title,
        content: updateArticleDto.content,
        ...(updateArticleDto.status
          ? { status: toPrismaStatus(updateArticleDto.status) }
          : {}),
        ...(updateArticleDto.authorId !== undefined
          ? { authorId: finalAuthorId }
          : {}),
        ...(updateArticleDto.categoryId !== undefined
          ? { categoryId: updateArticleDto.categoryId }
          : {}),
        ...(updateArticleDto.tags
          ? {
              tags: {
                set: [],
                connectOrCreate: updateArticleDto.tags?.map((tag) => ({
                  where: { name: tag },
                  create: { name: tag },
                })),
              },
            }
          : {}),
      },
      include: {
        tags: true,
      },
    });
    return toArticleDto(row);
  }

  async deleteArticle(id: string, actor: JwtPayload): Promise<void> {
    const article = await this.prisma.article.findUnique({
      where: { id },
    });
    if (!article) {
      throw new NotFoundException(`Article with id ${id} not found`);
    }
    this.assertEditorOwnsArticle(actor, article.authorId);
    await this.prisma.article.delete({
      where: { id },
    });
  }
}
